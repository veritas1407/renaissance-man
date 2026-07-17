// PDF.js wrapper. PDF bytes are streamed via the rm-asset:// Tauri URI scheme.
// Pages render lazily (IntersectionObserver) so a heavy book stays light; the
// reading column scrolls internally and saves position.percent to frontmatter.
//
// openReading() returns a small controller so the reading desk can drive the
// book after it is open:
//   const ctl = await openReading(columnEl, 'book.pdf', 'Readings/book.md', frac);
//   ctl.zoomIn(); ctl.zoomOut(); ctl.resetZoom(); ctl.getZoom();
//   ctl.relayout();   // re-fit pages (e.g. after entering full screen)

let pdfjsLib = null;

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('/assets/pdfjs/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.mjs';
  return pdfjsLib;
}

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.2;

export async function openReading(columnEl, attachmentFilename, readingPath, lastPosition = 0) {
  const lib = await ensurePdfJs();

  // Stream via the rm-asset custom scheme — avoids base64 IPC for large PDFs.
  // On Windows/Android Tauri serves registered schemes at http://<scheme>.localhost/;
  // on macOS/Linux as <scheme>://localhost/. Pick the form for this platform.
  const usesHttpForm = /Windows|Android/.test(navigator.userAgent);
  const schemeBase = usesHttpForm ? 'http://rm-asset.localhost' : 'rm-asset://localhost';
  const url = `${schemeBase}/attachments/${encodeURIComponent(attachmentFilename)}`;
  const pdf = await lib.getDocument({ url }).promise;

  columnEl.innerHTML = '';
  columnEl.dataset.readingPath = readingPath;
  columnEl.dataset.totalPages  = pdf.numPages;
  columnEl.style.overflowX = 'auto';      // zoomed-in pages can overflow the column

  // Base geometry from page 1 (assume uniform; the real render uses each page's own
  // viewport but maps it to the same display width for a tidy column).
  const page1 = await pdf.getPage(1);
  const base  = page1.getViewport({ scale: 1 });
  const DPR   = Math.min(window.devicePixelRatio || 1, 2);

  let zoom  = 1;
  let baseW = colWidth();
  let pageH = placeholderHeight();

  function colWidth() {
    return columnEl.clientWidth || columnEl.offsetWidth || 600;
  }
  function displayWidth() { return Math.round(baseW * zoom); }
  function placeholderHeight() {
    return Math.round((base.height / base.width) * displayWidth());
  }

  const rendered = new Set();
  async function renderPage(wrapper) {
    const n = +wrapper.dataset.page;
    if (rendered.has(n)) return;
    rendered.add(n);
    try {
      const page   = await pdf.getPage(n);
      const dispW  = displayWidth();
      const sc     = (dispW / base.width) * DPR;       // render at device pixels for crispness
      const vp     = page.getViewport({ scale: sc });
      const canvas = document.createElement('canvas');
      canvas.width  = vp.width;
      canvas.height = vp.height;
      // Display size: fit the column at zoom 1; explicit px (overflowing) when zoomed in.
      canvas.style.cssText = 'display:block;margin:0 auto;' +
        (zoom > 1 ? `width:${dispW}px;` : 'width:100%;');
      wrapper.style.height = '';            // let the real canvas define height
      wrapper.appendChild(canvas);
      wrapper.classList.add('rendered');
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    } catch (e) {
      rendered.delete(n);                   // allow a retry on next intersection
      console.debug('[pdfjs] page', n, 'failed', e);
    }
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) renderPage(e.target);
  }, { root: columnEl, rootMargin: '900px 0px' });

  // (Re)build the page placeholders for the current zoom, preserving scroll position.
  function buildPages() {
    const denom = (columnEl.scrollHeight - columnEl.clientHeight) || 1;
    const frac  = Math.min(1, Math.max(0, columnEl.scrollTop / denom));

    io.disconnect();
    rendered.clear();
    columnEl.innerHTML = '';
    baseW = colWidth();
    pageH = placeholderHeight();
    const dispW = displayWidth();

    for (let n = 1; n <= pdf.numPages; n++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page';
      wrapper.dataset.page = n;
      wrapper.style.cssText =
        `position:relative;margin:0 auto 10px;height:${pageH}px;background:#f6efdc;` +
        (zoom > 1 ? `width:${dispW}px;` : 'width:100%;');
      columnEl.appendChild(wrapper);
      io.observe(wrapper);
    }

    requestAnimationFrame(() => {
      columnEl.scrollTop = (columnEl.scrollHeight - columnEl.clientHeight) * frac;
    });
  }

  buildPages();

  // Restore last position (fraction of total height) on first open.
  if (lastPosition > 0) {
    requestAnimationFrame(() => { columnEl.scrollTop = columnEl.scrollHeight * lastPosition; });
  }

  // Live header (shared with the demo reader) + debounced save to frontmatter.
  const pctEl    = document.getElementById('readpct');
  const ribbonEl = document.getElementById('ribbonmark');
  let scrollTimer;
  columnEl.addEventListener('scroll', () => {
    const denom = (columnEl.scrollHeight - columnEl.clientHeight) || 1;
    const frac  = Math.min(1, Math.max(0, columnEl.scrollTop / denom));
    const pct   = Math.round(frac * 100);
    if (pctEl)    pctEl.textContent  = pct + '%';
    if (ribbonEl) ribbonEl.style.height = Math.max(4, pct) + '%';
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(async () => {
      if (!window.Bridge) return;
      try {
        const note = await window.Bridge.notes.readParsed(readingPath);
        if (!note) return;
        const fm = note.frontmatter || {};
        fm.position = (fm.position && typeof fm.position === 'object') ? fm.position : { page: 1 };
        fm.position.percent = pct;
        fm.last_touched = new Date().toISOString().slice(0, 10);
        await window.Bridge.notes.write(readingPath, fm, note.body || '');
      } catch (e) { console.debug('[pdfjs] save position', e); }
    }, 2500);
  }, { passive: true });

  function setZoom(z) {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
    if (next === zoom) return zoom;
    zoom = next;
    buildPages();
    return zoom;
  }

  return {
    numPages: pdf.numPages,
    isPdf: true,
    getZoom:   () => zoom,
    zoomIn:    () => setZoom(zoom + ZOOM_STEP),
    zoomOut:   () => setZoom(zoom - ZOOM_STEP),
    resetZoom: () => setZoom(1),
    relayout:  () => { baseW = colWidth(); buildPages(); },
  };
}

// Returns page number for a DOM element (PDF canvas wrapper)
export function getPageForElement(el) {
  const wrapper = el.closest('.pdf-page');
  return wrapper ? parseInt(wrapper.dataset.page, 10) : null;
}
