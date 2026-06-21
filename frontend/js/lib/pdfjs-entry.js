// PDF.js wrapper. PDF bytes are streamed via the rm-asset:// Tauri URI scheme.
// Usage:
//   import { openReading } from './pdfjs-entry.js';
//   await openReading(columnEl, 'Attachments/book.pdf', readingPath, lastPosition);

let pdfjsLib = null;

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('/assets/pdfjs/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.mjs';
  return pdfjsLib;
}

export async function openReading(columnEl, attachmentFilename, readingPath, lastPosition = 0) {
  const lib = await ensurePdfJs();

  // Stream via rm-asset:// — avoids base64 IPC overhead for large PDFs
  const url = `rm-asset://attachments/${encodeURIComponent(attachmentFilename)}`;
  const pdf = await lib.getDocument({ url }).promise;

  columnEl.innerHTML = '';
  columnEl.dataset.readingPath = readingPath;
  columnEl.dataset.totalPages  = pdf.numPages;

  const colWidth = columnEl.offsetWidth || 600;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page     = await pdf.getPage(pageNum);
    const scale    = colWidth / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });

    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page';
    wrapper.dataset.page = pageNum;
    wrapper.style.cssText = `position:relative;margin-bottom:2px;`;

    const pdfCanvas = document.createElement('canvas');
    pdfCanvas.width  = viewport.width;
    pdfCanvas.height = viewport.height;
    pdfCanvas.style.cssText = 'display:block;width:100%;';
    wrapper.appendChild(pdfCanvas);

    columnEl.appendChild(wrapper);
    await page.render({
      canvasContext: pdfCanvas.getContext('2d'),
      viewport,
    }).promise;
  }

  // Scroll to last_position (0.0–1.0 fraction of total height)
  if (lastPosition > 0) {
    const totalHeight = columnEl.scrollHeight;
    columnEl.scrollTop = totalHeight * lastPosition;
  }

  // Log session event
  if (window.Bridge) {
    const isResume = lastPosition > 0;
    await window.Bridge.stats.logSession(isResume ? 'resume' : 'start', readingPath, lastPosition);
  }

  // Debounced scroll → save position
  let scrollTimer;
  columnEl.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(async () => {
      if (!window.Bridge) return;
      const pos = columnEl.scrollTop / columnEl.scrollHeight;
      const note = await window.Bridge.notes.readParsed(readingPath);
      if (!note) return;
      note.frontmatter.last_position = pos;
      note.frontmatter.last_opened   = new Date().toISOString();
      await window.Bridge.notes.write(readingPath, note.frontmatter, note.body);
    }, 5000);
  }, { passive: true });
}

// Returns page number for a DOM element (PDF canvas wrapper)
export function getPageForElement(el) {
  const wrapper = el.closest('.pdf-page');
  return wrapper ? parseInt(wrapper.dataset.page, 10) : null;
}
