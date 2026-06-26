const path = require('path');
const fs = require('fs').promises;
const AdmZip = require('adm-zip');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

const EPUB_STORAGE_DIR = '/srv/reader/epubs/';

async function ensureEpubDirExists() {
  await fs.mkdir(EPUB_STORAGE_DIR, { recursive: true });
}

/**
 * Parse an EPUB file and extract metadata + chapter content.
 */
function parseEpub(filePath) {
  const zip = new AdmZip(filePath);
  
  // Find the OPF file (container.xml -> rootfile)
  const containerXml = zip.readAsText('META-INF/container.xml');
  const containerDom = new JSDOM(containerXml, { contentType: 'text/xml' });
  const rootfileEl = containerDom.window.document.querySelector('rootfile');
  if (!rootfileEl) throw new Error('No rootfile found in container.xml');
  const opfPath = rootfileEl.getAttribute('full-path');
  
  // Read OPF
  const opfXml = zip.readAsText(opfPath);
  const opfDom = new JSDOM(opfXml, { contentType: 'text/xml' });
  const opfDoc = opfDom.window.document;
  
  const opfDir = path.dirname(opfPath);
  
  // Metadata
  const metadataEl = opfDoc.querySelector('metadata');
  const title = getOpfText(metadataEl, 'title') || 'Unknown Title';
  const author = getOpfText(metadataEl, 'creator') || getOpfText(metadataEl, 'author') || 'Unknown Author';
  
  // Cover image
  let coverDataUrl = null;
  const coverMeta = metadataEl?.querySelector('meta[name="cover"]');
  if (coverMeta) {
    const coverId = coverMeta.getAttribute('content');
    const manifestEl = opfDoc.querySelector('manifest');
    const coverItem = manifestEl?.querySelector(`[id="${coverId}"], [id="${coverId}-image"], [href$="${coverId}"]`);
    if (coverItem) {
      const coverHref = coverItem.getAttribute('href');
      const coverFullPath = path.join(opfDir, coverHref).replace(/\\/g, '/');
      try {
        const coverBuffer = zip.readFile(coverFullPath);
        if (coverBuffer) {
          const ext = path.extname(coverHref).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
          coverDataUrl = `data:${mime};base64,${coverBuffer.toString('base64')}`;
        }
      } catch (e) {
        console.warn('Could not extract cover:', e.message);
      }
    }
  }
  
  // Spine (reading order)
  const spineEl = opfDoc.querySelector('spine');
  const spineItems = spineEl ? Array.from(spineEl.querySelectorAll('itemref')) : [];
  
  // Manifest (all resources)
  const manifestEl = opfDoc.querySelector('manifest');
  const manifestItems = {};
  if (manifestEl) {
    Array.from(manifestEl.querySelectorAll('item')).forEach(item => {
      manifestItems[item.getAttribute('id')] = {
        href: item.getAttribute('href'),
        mediaType: item.getAttribute('media-type'),
        id: item.getAttribute('id')
      };
    });
  }
  
  // Build chapter list from spine order
  const chapters = [];
  
  for (let i = 0; i < spineItems.length; i++) {
    const idref = spineItems[i].getAttribute('idref');
    const manifestItem = manifestItems[idref];
    
    if (!manifestItem) continue;
    
    // Only include XHTML/HTML content
    if (!manifestItem.mediaType || 
        (!manifestItem.mediaType.includes('xhtml') && 
         !manifestItem.mediaType.includes('html') &&
         !manifestItem.href.endsWith('.xhtml') && 
         !manifestItem.href.endsWith('.html') &&
         !manifestItem.href.endsWith('.htm'))) continue;
    
    const href = manifestItem.href;
    const hrefFull = path.join(opfDir, href).replace(/\\/g, '/');
    
    // Get chapter title from nav/toc
    let chapterTitle = `Kapitel ${i + 1}`;
    
    try {
      const chapterContent = zip.readAsText(hrefFull);
      const chapterDom = new JSDOM(chapterContent, { contentType: 'text/xml' });
      const doc = chapterDom.window.document;
      
      // Try to get title from h1-h3 or title tag
      const heading = doc.querySelector('h1, h2, h3');
      if (heading) {
        chapterTitle = heading.textContent.trim();
      }
      
      // Extract clean text (remove script, style tags)
      const scripts = doc.querySelectorAll('script, style, nav');
      scripts.forEach(s => s.remove());
      
      const body = doc.querySelector('body');
      const cleanText = body ? body.textContent.replace(/\s+/g, ' ').trim() : '';
      
      chapters.push({
        index: i,
        title: chapterTitle,
        href: hrefFull,
        text: cleanText
      });
    } catch (e) {
      console.warn(`Could not parse chapter ${hrefFull}:`, e.message);
      chapters.push({
        index: i,
        title: chapterTitle,
        href: hrefFull,
        text: `[Could not load chapter content]`
      });
    }
  }
  
  return { title, author, coverDataUrl, chapters };
}

function getOpfText(parentEl, tagName) {
  if (!parentEl) return null;
  // Try dc: namespace (JSDOM stores ns-prefixed tags literally)
  const el = parentEl.querySelector('dc\\:' + tagName) || 
             parentEl.querySelector(tagName);
  return el ? el.textContent.trim() : null;
}

async function saveEpub(fileBuffer, originalFilename) {
  await ensureEpubDirExists();
  
  const sanitizedFilename = originalFilename.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
  const fileId = crypto.randomUUID();
  const filePath = path.join(EPUB_STORAGE_DIR, `${fileId}-${sanitizedFilename}`);
  
  await fs.writeFile(filePath, fileBuffer);
  const stats = await fs.stat(filePath);
  
  const parsed = parseEpub(filePath);
  
  return {
    id: fileId,
    title: parsed.title,
    author: parsed.author,
    coverDataUrl: parsed.coverDataUrl,
    filePath: filePath,
    fileSize: stats.size,
    totalChapters: parsed.chapters.length,
    chapters: parsed.chapters.map(c => ({ index: c.index, title: c.title, href: c.href }))
  };
}

function getChapterText(filePath, chapterIndex) {
  const parsed = parseEpub(filePath);
  const chapter = parsed.chapters.find(c => c.index === chapterIndex);
  if (!chapter) return null;
  return chapter.text;
}

module.exports = {
  ensureEpubDirExists,
  saveEpub,
  parseEpub,
  getChapterText
};