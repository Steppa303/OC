// Reader App - Frontend Logic
// No AI watermarks, no "created with" nonsense.

const API_BASE = '';

let currentBook = null;
let chapters = [];
let currentChapterIndex = 0;
let isPlaying = false;
let audioContext = null;
let audioSource = null;

// --- DOM refs ---
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const dom = {
  shelf: $('#shelf-view'),
  reader: $('#reader-view'),
  bookGrid: $('#book-grid'),
  dropzone: $('#dropzone'),
  fileInput: $('#file-input'),
  uploadProgress: $('#upload-progress'),
  progressFill: $('#progress-fill'),
  progressText: $('#progress-text'),
  uploadError: $('#upload-error'),
  readerTitle: $('#reader-title'),
  contentArea: $('#content-area'),
  backBtn: $('#back-btn'),
  tocBtn: $('#toc-btn'),
  tocPanel: $('#toc-panel'),
  tocList: $('#toc-list'),
  bookmarkBtn: $('#bookmark-btn'),
  bookmarkIcon: $('#bookmark-icon'),
  playBtn: $('#play-btn'),
  playIcon: $('#play-icon'),
  prevBtn: $('#prev-btn'),
  nextBtn: $('#next-btn'),
  stopBtn: $('#stop-btn'),
  speedRange: $('#speed-range'),
  speedLabel: $('#speed-label'),
  voiceSelect: $('#voice-select'),
  timeCurrent: $('#time-current'),
  timeTotal: $('#time-total'),
  themeBtn: $('#theme-btn'),
  themeIcon: $('#theme-icon'),
};

// --- Audio State ---
let audioEl = null;
let currentAudioUrl = null;
let isPaused = false;

// --- API ---
async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || 'API Error');
  }
  return opts.raw ? res : res.json();
}

// --- Theme ---
function initTheme() {
  const saved = localStorage.getItem('reader-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  dom.themeIcon.className = `icon icon-${saved === 'dark' ? 'moon' : 'sun'}`;
}

dom.themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('reader-theme', next);
  dom.themeIcon.className = `icon icon-${next === 'dark' ? 'moon' : 'sun'}`;
});

// --- Upload ---
dom.dropzone.addEventListener('click', () => dom.fileInput.click());

dom.dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dom.dropzone.classList.add('dragover');
});

dom.dropzone.addEventListener('dragleave', () => {
  dom.dropzone.classList.remove('dragover');
});

dom.dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dom.dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) uploadEpub(file);
});

dom.fileInput.addEventListener('change', () => {
  const file = dom.fileInput.files[0];
  if (file) uploadEpub(file);
});

async function uploadEpub(file) {
  if (!file.name.toLowerCase().endsWith('.epub')) {
    showError('Nur .epub Dateien, Digga.');
    return;
  }

  dom.uploadProgress.classList.remove('hidden');
  dom.uploadError.classList.add('hidden');
  dom.progressFill.style.width = '0%';
  dom.progressText.textContent = '0%';

  const formData = new FormData();
  formData.append('epub', file);

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        dom.progressFill.style.width = `${pct}%`;
        dom.progressText.textContent = `${pct}%`;
      }
    };

    const result = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(formData);
    });

    dom.progressFill.style.width = '100%';
    dom.progressText.textContent = '✅ Verarbeitet!';
    setTimeout(() => {
      dom.uploadProgress.classList.add('hidden');
      dom.fileInput.value = '';
    }, 1500);

    loadBookshelf();
  } catch (err) {
    showError(err.message);
    dom.uploadProgress.classList.add('hidden');
  }
}

function showError(msg) {
  dom.uploadError.textContent = msg;
  dom.uploadError.classList.remove('hidden');
  setTimeout(() => dom.uploadError.classList.add('hidden'), 5000);
}

// --- Bookshelf ---
async function loadBookshelf() {
  try {
    const books = await api('/api/books');
    dom.bookGrid.innerHTML = '';

    if (books.length === 0) {
      dom.bookGrid.innerHTML = `
        <div class="empty-shelf">
          <i class="icon icon-book-open" style="font-size: 48px; opacity: 0.3;"></i>
          <p>Noch keine Bücher. Lade ein EPUB hoch!</p>
        </div>
      `;
      return;
    }

    books.forEach(book => {
      const coverHtml = book.cover_path
        ? `<img src="${book.cover_path}" alt="${book.title}" class="book-cover-img" loading="lazy">`
        : `<div class="book-cover-placeholder"><i class="icon icon-book" style="font-size: 36px;"></i></div>`;

      const progress = book.last_chapter !== null
        ? Math.round((book.last_chapter / (book.total_chapters || 1)) * 100)
        : 0;

      const card = document.createElement('div');
      card.className = 'book-card';
      card.dataset.id = book.id;
      card.innerHTML = `
        <div class="book-cover">${coverHtml}</div>
        <div class="book-info">
          <div class="book-title">${escapeHtml(book.title)}</div>
          <div class="book-author">${escapeHtml(book.author)}</div>
          ${progress > 0 ? `
            <div class="book-progress">
              <div class="book-progress-bar">
                <div class="book-progress-fill" style="width: ${progress}%"></div>
              </div>
              <span class="book-progress-text">${progress}%</span>
            </div>
          ` : ''}
        </div>
      `;
      card.addEventListener('click', () => openBook(book.id));
      dom.bookGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load bookshelf:', err);
    dom.bookGrid.innerHTML = `
      <div class="empty-shelf error">
        <i class="icon icon-alert-circle" style="font-size: 36px;"></i>
        <p>Fehler beim Laden: ${err.message}</p>
      </div>
    `;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// --- Reader ---
async function openBook(bookId) {
  stopAudio();

  try {
    const content = await api(`/api/books/${bookId}/content`);
    currentBook = { id: bookId, title: content.title };
    chapters = content.chapters || [];

    if (chapters.length === 0) {
      showError('Dieses Buch hat keine lesbaren Kapitel.');
      return;
    }

    // Check for last bookmark
    try {
      const bm = await api(`/api/bookmarks/${bookId}`);
      currentChapterIndex = bm.chapter_index || 0;
    } catch {
      currentChapterIndex = 0;
    }

    dom.readerTitle.textContent = content.title;
    switchView('reader');
    loadChapter(currentChapterIndex);
    buildToc();
  } catch (err) {
    showError(`Fehler beim Öffnen: ${err.message}`);
  }
}

function switchView(view) {
  dom.shelf.classList.toggle('active', view === 'shelf');
  dom.reader.classList.toggle('active', view === 'reader');
}

function loadChapter(index) {
  if (!chapters[index]) return;
  currentChapterIndex = index;
  dom.contentArea.innerHTML = `<div class="chapter-content">${formatChapterText(chapters[index].text)}</div>`;
  dom.contentArea.scrollTop = 0;
  updateTocActive();
  updateBookmarkIcon();
  updatePlayerState();

  // Track scroll position
  dom.contentArea.onscroll = throttle(() => {
    saveProgress(currentChapterIndex, dom.contentArea.scrollTop);
  }, 2000);
}

function formatChapterText(text) {
  if (!text) return '<p class="empty-chapter">Kein Inhalt in diesem Kapitel.</p>';
  
  // Split by double newlines for paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  if (paragraphs.length === 0) {
    return `<p>${escapeHtml(text.trim())}</p>`;
  }

  return paragraphs
    .map((p, idx) => {
      const clean = p.replace(/\s+/g, ' ').trim();
      if (!clean) return '';
      // Detect headings: first paragraph if short, OR uppercase, OR ends with colon, OR starts with Kapitel/Chapter
      const isHeading = idx === 0 && clean.length < 120 ||
                        clean === clean.toUpperCase() && clean.length > 2 ||
                        clean.endsWith(':') ||
                        /^(kapitel|chapter|teil|section|prolog|epilog|vorwort|einführung)\b/i.test(clean);
      if (isHeading) {
        return `<h2 class="chapter-heading">${escapeHtml(clean)}</h2>`;
      }
      return `<p>${escapeHtml(clean)}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

// --- Navigation ---
dom.backBtn.addEventListener('click', () => {
  stopAudio();
  switchView('shelf');
  loadBookshelf();
});

dom.prevBtn.addEventListener('click', () => {
  if (currentChapterIndex > 0) {
    stopAudio();
    loadChapter(currentChapterIndex - 1);
  }
});

dom.nextBtn.addEventListener('click', () => {
  if (currentChapterIndex < chapters.length - 1) {
    stopAudio();
    loadChapter(currentChapterIndex + 1);
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!dom.reader.classList.contains('active')) return;

  if (e.key === 'ArrowLeft') {
    dom.prevBtn.click();
  } else if (e.key === 'ArrowRight') {
    dom.nextBtn.click();
  } else if (e.key === ' ') {
    e.preventDefault();
    dom.playBtn.click();
  } else if (e.key === 'Escape') {
    dom.backBtn.click();
  }
});

// --- TOC ---
dom.tocBtn.addEventListener('click', () => {
  dom.tocPanel.classList.toggle('hidden');
});

function buildToc() {
  dom.tocList.innerHTML = chapters
    .map((ch, i) => `<li class="toc-item" data-index="${i}">${escapeHtml(ch.title || `Kapitel ${i + 1}`)}</li>`)
    .join('');

  dom.tocList.addEventListener('click', (e) => {
    const item = e.target.closest('.toc-item');
    if (item) {
      stopAudio();
      loadChapter(parseInt(item.dataset.index));
      dom.tocPanel.classList.add('hidden');
    }
  });
}

function updateTocActive() {
  $$('.toc-item').forEach(el => el.classList.remove('active'));
  const active = $(`.toc-item[data-index="${currentChapterIndex}"]`);
  if (active) active.classList.add('active');
}

// --- Bookmarks ---
dom.bookmarkBtn.addEventListener('click', async () => {
  if (!currentBook) return;

  try {
    const progress = dom.contentArea.scrollTop / (dom.contentArea.scrollHeight - dom.contentArea.clientHeight);
    await api(`/api/bookmarks/${currentBook.id}`, {
      method: 'POST',
      body: JSON.stringify({ chapterIndex: currentChapterIndex, progress: isNaN(progress) ? 0 : progress }),
    });
    updateBookmarkIcon(true);
    showToast('Lesezeichen gespeichert!');
  } catch (err) {
    console.error('Bookmark failed:', err);
  }
});

async function updateBookmarkIcon(saved = false) {
  if (!currentBook) return;

  try {
    const bm = await api(`/api/bookmarks/${currentBook.id}`);
    const isCurrent = bm.chapter_index === currentChapterIndex;
    dom.bookmarkIcon.className = `icon icon-${isCurrent ? 'bookmark-check' : 'bookmark'}`;
  } catch {
    dom.bookmarkIcon.className = 'icon icon-bookmark';
  }
}

async function saveProgress(chapterIndex, scrollTop) {
  if (!currentBook) return;
  const total = dom.contentArea.scrollHeight - dom.contentArea.clientHeight;
  const progress = total > 0 ? scrollTop / total : 0;

  try {
    await api(`/api/bookmarks/${currentBook.id}`, {
      method: 'POST',
      body: JSON.stringify({ chapterIndex, progress }),
    });
  } catch {}
}

// --- Toast ---
let toastTimeout;

function showToast(msg) {
  let toast = $('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- TTS Player ---
function updatePlayerState({ forcePlayIcon = false } = {}) {
    const hasText = chapters[currentChapterIndex]?.text?.trim();
    dom.playBtn.disabled = !hasText;

    if (forcePlayIcon && hasText && !isPlaying) {
        dom.playIcon.className = 'icon icon-play';
    } else if (hasText) {
        dom.playIcon.className = `icon icon-${isPlaying && !isPaused ? 'pause' : 'play'}`;
    } else {
        dom.playIcon.className = 'icon icon-play';
    }
}

dom.playBtn.addEventListener('click', async () => {
  if (!currentBook || !chapters[currentChapterIndex]) return;

  if (isPlaying && !isPaused) {
    pauseAudio();
    return;
  }

  if (isPaused && audioEl) {
    resumeAudio();
    return;
  }

  await playChapter(currentChapterIndex);
});

dom.stopBtn.addEventListener('click', stopAudio);
dom.stopBtn.disabled = false;

dom.speedRange.addEventListener('input', () => {
  const speed = parseFloat(dom.speedRange.value);
  dom.speedLabel.textContent = `${speed.toFixed(1)}×`;
  if (audioEl) {
    audioEl.playbackRate = speed;
  }
});

async function playChapter(index) {
  stopAudio();

  const chapter = chapters[index];
  if (!chapter?.text || !chapter.text.trim()) {
    showError('Dieses Kapitel hat keinen lesbaren Text.');
    return;
  }

  try {
    dom.playIcon.className = 'icon icon-loader';
    isPlaying = true;
    dom.stopBtn.disabled = false;

    const voiceId = dom.voiceSelect.value;

    // Stream audio from server
    const res = await fetch(`${API_BASE}/api/books/${currentBook.id}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterIndex: index, voiceId }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
      isPlaying = false;
      dom.playIcon.className = 'icon icon-play';
      showError(errData.error || 'TTS fehlgeschlagen.');
      return;
    }

    // Create blob URL from stream
    const blob = await res.blob();
    currentAudioUrl = URL.createObjectURL(blob);

    audioEl = new Audio(currentAudioUrl);
    audioEl.playbackRate = parseFloat(dom.speedRange.value);

    audioEl.onloadedmetadata = () => {
      dom.timeTotal.textContent = formatTime(audioEl.duration);
    };

    audioEl.ontimeupdate = () => {
      dom.timeCurrent.textContent = formatTime(audioEl.currentTime);
    };

    audioEl.onplay = () => {
      isPlaying = true;
      isPaused = false;
      dom.playIcon.className = 'icon icon-pause';
      dom.stopBtn.disabled = false;
    };

    audioEl.onpause = () => {
      isPaused = true;
      dom.playIcon.className = 'icon icon-play';
    };

    audioEl.onended = () => {
      // Auto-advance to next chapter
      if (currentChapterIndex < chapters.length - 1) {
        loadChapter(currentChapterIndex + 1);
        playChapter(currentChapterIndex);
      } else {
        stopAudio();
        showToast('📖 Buch fertig vorgelesen!');
      }
    };

    audioEl.onerror = () => {
      isPlaying = false;
      isPaused = false;
      dom.playIcon.className = 'icon icon-play';
      showError('Audio-Wiedergabe fehlgeschlagen.');
    };

    await audioEl.play();
    dom.playIcon.className = 'icon icon-pause';
  } catch (err) {
    isPlaying = false;
    isPaused = false;
    dom.playIcon.className = 'icon icon-play';
    console.error('TTS error:', err);
    showError('TTS fehlgeschlagen: ' + err.message);
  }
}

function pauseAudio() {
  if (audioEl) {
    audioEl.pause();
    isPaused = true;
  }
}

function resumeAudio() {
  if (audioEl) {
    audioEl.play().catch(() => {});
    isPaused = false;
  }
}

function stopAudio() {
  if (audioEl) {
    audioEl.pause();
    audioEl = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  isPlaying = false;
  isPaused = false;
  dom.playIcon.className = 'icon icon-play';
  dom.timeCurrent.textContent = '0:00';
  dom.timeTotal.textContent = '0:00';
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Utility ---
function throttle(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) return;
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  };
}

// --- Init ---
initTheme();

// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
  loadBookshelf();
});
