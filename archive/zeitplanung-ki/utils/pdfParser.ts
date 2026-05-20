import * as pdfjsLib from 'pdfjs-dist';

// Set worker source relative to the version used
// Note: In a real bundler environment this would be handled differently, 
// but with import maps/ESM in browser, we point to the CDN.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    // Limit to first 5 pages to save token/perf
    const maxPages = Math.min(pdf.numPages, 5);
    
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n`;
    }
    
    if (pdf.numPages > maxPages) {
        fullText += `\n... (Restliche ${pdf.numPages - maxPages} Seiten ignoriert) ...`;
    }
    
    return fullText;
  } catch (error) {
    console.error("PDF Parsing Error:", error);
    return `(Fehler beim Lesen der PDF: ${file.name})`;
  }
};