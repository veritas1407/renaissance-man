// vault.js — everything that talks to the vault through the Bridge (module).
// Bridge/invoke, boot paths (vault-ready + proactive bootstrap), Threshold
// loaders, tasks, triage, resurfacing, threads, the Study, training table,
// observatory, works/feats/depth, reading room (shelf/desk/PDF), palette,
// search, ferry, mobile motion. Extracted verbatim from index.html.

// (The 3D vestibule was removed per ROADMAP.md §0: the palace is plates in a
//  codex, never a game level. The backdrop is a still, dimmed master painting.)

// ---- Bridge: thin typed wrapper, degrades gracefully in browser ----
const IS_TAURI = typeof window.__TAURI__ !== 'undefined';
// Tauri 2: invoke lives under .core (was top-level in Tauri 1)
const __invoke = () => (window.__TAURI__.core && window.__TAURI__.core.invoke) || window.__TAURI__.invoke;
const inv = (cmd, args={}) => IS_TAURI ? __invoke()(cmd, args) : Promise.resolve(null);

window.Bridge = {
  vault: {
    pick:         ()    => inv('pick_vault_folder'),
    getPath:      ()    => inv('get_vault_path'),
    listFiles:         (sub) => inv('list_vault_files',{subfolder:sub}),
    pickOneThing:      ()    => inv('pick_one_thing'),
    listNotesForAtlas: ()    => inv('list_notes_for_atlas'),
  },
  notes: {
    // Tauri 2 expects camelCase arg keys; the macro maps them to snake_case Rust params.
    readParsed: (p)               => inv('read_note_parsed',{relativePath:p}),
    write:      (p,fm,body)       => inv('write_frontmatter',{relativePath:p,frontmatterVal:fm,body}),
    create:     (sub,slug,fm,body)=> inv('create_note',{subfolder:sub,slug,frontmatterVal:fm,body}),
    append:     (p,text)          => inv('append_to_note',{relativePath:p,text}),
    trash:      (p)               => inv('trash_note',{relativePath:p}),
  },
  capture: {
    save:     (kind,tags,content) => inv('save_capture',{kind,tags,content}),
    list:     (processed)         => inv('list_captures',{processed}),
    markDone: (p)                 => inv('mark_capture_processed',{relativePath:p}),
  },
  pdf: {
    saveHighlight: (rp,hl) => inv('save_highlight',{readingPath:rp,highlight:hl}),
    import:        ()      => inv('import_pdf'),
    remove:        (rp)    => inv('remove_reading',{readingPath:rp}),
  },
  search: {
    fts:      (q,n) => inv('search_fts',{query:q,limit:n}),
    semantic: (q,n) => inv('search_semantic',{query:q,limit:n}),
    find:          (t,n)   => inv('find_similar',{text:t,limit:n}),
    conceptEdges:  (thr)   => inv('get_concept_edges', thr != null ? {threshold:thr} : {}),
    rebuild:       ()      => inv('rebuild_index'),
  },
  stats: {
    logSession:  (type,path,pos) => inv('log_session_event',{eventType:type,readingPath:path,scrollPosition:pos}),
    reentryRate: (days)          => inv('get_reentry_rate',{days}),
  },
};

// ---- First-run onboarding: four leaves, shown once per vault path, skippable ----
(function(){
  var scrim=document.getElementById('onboard-scrim');
  if(!scrim)return;
  var leaves=Array.prototype.slice.call(scrim.querySelectorAll('.onboard-leaf'));
  var dotsWrap=document.getElementById('onboard-dots');
  var nextBtn=document.getElementById('onboard-next');
  var skipBtn=document.getElementById('onboard-skip');
  var idx=0;
  leaves.forEach(function(_,i){
    var d=document.createElement('span');d.className='onboard-dot'+(i===0?' on':'');
    dotsWrap.appendChild(d);
  });
  var dots=Array.prototype.slice.call(dotsWrap.children);
  function show(i){
    idx=i;
    leaves.forEach(function(l,li){l.classList.toggle('on',li===i);});
    dots.forEach(function(d,di){d.classList.toggle('on',di===i);});
    nextBtn.textContent=(i===leaves.length-1)?'begin':'turn the page';
  }
  function close(){scrim.classList.remove('on');}
  nextBtn.addEventListener('click',function(){
    if(idx>=leaves.length-1){close();return;}
    show(idx+1);
  });
  skipBtn.addEventListener('click',close);
  scrim.addEventListener('click',function(e){if(e.target===scrim)close();});
  var attempted=false;
  window.RM_maybeOnboard=function(path){
    if(!path||attempted)return;
    attempted=true;
    var key='rm-welcomed:'+path;
    try{if(localStorage.getItem(key))return;}catch(e){}
    show(0);
    scrim.classList.add('on');
    try{localStorage.setItem(key,'1');}catch(e){}
  };
})();

// ---- Trust: demo content never survives contact with a real vault ----
// Anything marked data-demo is a browser-preview mockup with no real loader
// behind it (e.g. the Reading Room's fixed research-thread pins). Everything
// else tears down inside its own loader's empty-state branch instead.
function clearDemoScaffold() {
  document.querySelectorAll('[data-demo]').forEach(function(n){ n.hidden = true; });
}
window.clearDemoScaffold = clearDemoScaffold;

// ---- Vault events from Rust ----
if (IS_TAURI) {
  const { listen } = window.__TAURI__.event;
  listen('vault-ready', () => {
    document.getElementById('vault-overlay').style.display = 'none';
    clearDemoScaffold();
    if (window.RM_maybeOnboard) window.Bridge.vault.getPath().then(window.RM_maybeOnboard).catch(() => {});
    loadThresholdCard();
    loadThresholdGoal();
    loadMomentumLine();
    loadLifeStats();
    // one-ask budget: the thread card asks first (seal/rekindle); only if it
    // stays quiet may Mnemosyne or the Bridge speak this session
    loadThreadCard().then(() => { loadResurface(); loadBridgePrompt(); });
    loadEpigraph();
    loadRabbitHole();
    loadIntentions();
    loadTasks();
    loadInboxCount();
    loadReadingsList();
    if (window.RM_loadPursuits) window.RM_loadPursuits();
    if (window.RM_loadGoalsFromVault) window.RM_loadGoalsFromVault();
    if (window.RM_loadThreadsIntoSky) window.RM_loadThreadsIntoSky();
    if (window.RM_loadGym) window.RM_loadGym();
    if (window.RM_loadCabinet) window.RM_loadCabinet();
    if (window.RM_loadWorks) window.RM_loadWorks();
    if (window.RM_loadDepth) window.RM_loadDepth();
    if (window.RM_loadFeats) window.RM_loadFeats();
    if (window.RM_loadLifeDays) window.RM_loadLifeDays();
    if (window.RM_loadStudy) window.RM_loadStudy();
  });
  listen('show-vault-picker', () => {
    document.getElementById('vault-overlay').style.display = 'flex';
  });
}

// ---- The ferry: the vault as one zip, desk ↔ hand ----
if (IS_TAURI) {
  const ferry = document.getElementById('vault-ferry');
  if (ferry) ferry.style.display = 'block';
  const fi = document.getElementById('ferry-import');
  const fe = document.getElementById('ferry-export');
  if (fi) fi.addEventListener('click', async () => {
    try {
      const n = await inv('import_vault_zip');
      if (window.flash) window.flash('the vault has come aboard — ' + n + ' page' + (n === 1 ? '' : 's'));
    } catch (e) {
      // a cancelled picker is not an error worth ink
      if (window.flash && String(e).indexOf('No archive') < 0) window.flash('the satchel would not open');
    }
  });
  if (fe) fe.addEventListener('click', async () => {
    try {
      const n = await inv('export_vault_zip');
      if (window.flash) window.flash('the vault is packed — ' + n + ' page' + (n === 1 ? '' : 's'));
    } catch (e) {
      if (window.flash && String(e).indexOf('No destination') < 0) window.flash('the satchel would not close');
    }
  });
}

// ---- Loop 1: Capture — inbox count from vault ----
async function loadInboxCount() {
  try {
    const items = await window.Bridge.capture.list(false);
    if (!items) return;
    const el = document.getElementById('inboxn');
    if (el) el.textContent = items.length;
  } catch(e) { /* vault not ready yet */ }
}
window.loadInboxCount = loadInboxCount;

// ---- Loop 1 (cont.): Inbox triage — Hermes finishes the delivery ----
// The capture loop wrote the thought down; triage gives it a home. One card at a
// time (§4), each routed to Readings / Goals / Bucket / Notes — or dismissed.
// Backend already exists (capture.list / capture.markDone); this is pure frontend.
{
  const scrim = document.getElementById('triage-scrim');
  const sub   = document.getElementById('triage-sub');
  const bodyEl= document.getElementById('triage-body');
  const pill  = document.getElementById('inboxpill');
  let queue = [];

  const today = () => new Date().toISOString().slice(0, 10);
  const slugifyJS = (t) => String(t || '').toLowerCase()
    .replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 48) || ('note-' + Math.random().toString(36).slice(2, 7));
  const captureTitle = (text) => {
    const first = String(text || '').split('\n')[0].trim().replace(/^https?:\/\//, '');
    return first.slice(0, 80) || 'untitled';
  };
  const isUrl = (text) => /^https?:\/\/\S+$/i.test(String(text || '').trim());
  const agoLabel = (iso) => {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (isNaN(days)) return '';
    return days <= 0 ? ' · today' : days === 1 ? ' · yesterday' : ` · ${days} days ago`;
  };

  // create_note errors if the slug already exists; retry with a short suffix.
  async function createUnique(subfolder, baseSlug, fm, body) {
    let slug = baseSlug;
    for (let i = 0; i < 6; i++) {
      try { return await window.Bridge.notes.create(subfolder, slug, fm, body); }
      catch (e) {
        if (String(e).indexOf('already exists') !== -1) {
          slug = baseSlug + '-' + Math.random().toString(36).slice(2, 5);
          continue;
        }
        throw e;
      }
    }
    throw new Error('could not create note');
  }

  function closeTriage() { scrim.classList.remove('on'); }

  async function openTriage() {
    if (!window.Bridge) { window.flash?.('triage available in the Tauri app'); return; }
    try {
      const items = await window.Bridge.capture.list(false);
      queue = Array.isArray(items) ? items.slice() : [];
    } catch (e) { queue = []; }
    scrim.classList.add('on');
    renderTriage();
  }

  function renderTriage() {
    if (!queue.length) {
      sub.textContent = '— nothing waiting —';
      bodyEl.innerHTML =
        '<div class="tri-clear">❧ The inbox is clear. Nothing else needs sorting.</div>' +
        '<div class="tri-foot"><button class="tbtn-link" data-tri="close">close</button></div>';
      return;
    }
    const it = queue[0];
    const n = queue.length;
    sub.textContent = `— ${n} ${n === 1 ? 'thing' : 'things'} to sort · one at a time —`;
    bodyEl.innerHTML =
      '<div class="tri-kind">' + escHtml(it.kind || 'note') + agoLabel(it.created_at) + '</div>' +
      '<div class="tri-text">' + escHtml(it.content || '(empty)') + '</div>' +
      '<div class="tri-similar" id="tri-sim-box" style="display:none"></div>' +
      '<div class="tri-actions">' +
        '<button class="tbtn" data-tri="reading">→ a reading</button>' +
        '<button class="tbtn" data-tri="goal">⮕ forge a goal</button>' +
        '<button class="tbtn" data-tri="bucket">✦ a wish</button>' +
        '<button class="tbtn" data-tri="note">❧ keep as note</button>' +
        '<button class="tbtn dismiss" data-tri="dismiss">dismiss</button>' +
      '</div>' +
      '<div class="tri-foot"><button class="tbtn-link" data-tri="close">close · sort the rest later</button></div>';

    // Async semantic dedup: show similar existing notes/captures without blocking the card.
    // Only surfaces if cosine >= 0.62 — conservative threshold to avoid false positives.
    const captureText = it.content || '';
    if (captureText.trim() && window.Bridge?.search?.find) {
      window.Bridge.search.find(captureText, 3).then(hits => {
        const box = document.getElementById('tri-sim-box');
        if (!box) return; // user advanced before results arrived
        const close = hits.filter(h => (h.score || 0) >= 0.62);
        if (!close.length) return;
        box.innerHTML =
          '<div class="tsi-label">already in your notes</div>' +
          close.map(h => '<div class="tsi-item">❧ ' + escHtml(h.title || h.path) + '</div>').join('');
        box.style.display = '';
      }).catch(() => {});
    }
  }

  // prompt for the atomic core claim of a newly-created note (one sentence, skippable)
  function showCoreClaim({ noteRel, fm, body }) {
    bodyEl.innerHTML =
      '<div class="tri-kind" style="color:var(--gold);font-size:13px;margin-bottom:8px">note inscribed</div>' +
      '<div style="font-size:17px;font-style:italic;color:var(--ink-2);margin-bottom:12px">In one sentence — what does this note claim?</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<input type="text" id="core-input" placeholder="e.g. Attention is a finite resource shaped by…" maxlength="160" ' +
               'style="flex:1;min-width:180px;background:var(--vellum-lit);border:1px solid var(--rule-2);border-radius:3px;' +
               'padding:7px 10px;font-family:var(--serif);font-size:15px;color:var(--ink);outline:none">' +
        '<button class="btn gold" id="core-save" style="padding:7px 14px;font-size:14px;white-space:nowrap">Inscribe</button>' +
        '<button class="btn ghost" id="core-skip" style="padding:7px 10px;font-size:14px;color:var(--ink-3)">skip</button>' +
      '</div>';
    function advance() {
      queue.shift(); renderTriage(); loadInboxCount();
      if (window.loadThresholdCard) loadThresholdCard();
    }
    document.getElementById('core-save')?.addEventListener('click', async () => {
      const core = (document.getElementById('core-input')?.value || '').trim();
      if (core) {
        try { await window.Bridge.notes.write(noteRel, {...fm, core}, body); }
        catch(e) { console.debug('[core-save]', e); }
      }
      advance();
    }, { once: true });
    document.getElementById('core-skip')?.addEventListener('click', advance, { once: true });
    document.getElementById('core-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('core-save')?.click(); }
    });
    setTimeout(() => document.getElementById('core-input')?.focus(), 50);
  }

  // route the current capture to its home, mark it sorted, advance to the next
  async function sortCurrent(dest) {
    const it = queue[0];
    if (!it) return;
    const text  = it.content || '';
    const title = captureTitle(text);
    let flashMsg = '';
    let coreData = null;
    try {
      if (dest === 'reading') {
        const url = isUrl(text);
        const fm = { type:'reading', title, source: url ? text.trim() : '', status:'queued',
                     added: today(), temp:'warm', position:{ percent:0 }, why:'' };
        await createUnique('Readings', slugifyJS(title), fm, url ? '' : text);
        flashMsg = 'sent to the shelf · ' + title;
      } else if (dest === 'bucket') {
        const fm = { type:'bucket', title, domain:'', cost:'mid', effort:'mid', season:'any', status:'open' };
        await createUnique('Bucket', slugifyJS(title), fm, text);
        flashMsg = 'into the wishbook · ' + title;
      } else if (dest === 'note') {
        const fm = { type:'note', title, created: today() };
        const noteRel = await createUnique('Notes', slugifyJS(title), fm, text);
        const checkText = text.slice(0, 300);
        if (checkText.trim() && window.Bridge?.search?.find) {
          window.Bridge.search.find(checkText, 3).then(hits => {
            const close = (hits || []).filter(h => (h.score || 0) >= 0.65 && h.path !== noteRel);
            if (close.length > 0) {
              const bq = JSON.parse(localStorage.getItem('rm-bridge-queue') || '[]');
              bq.push({ source1: noteRel, source2: close[0].path, matchTitle: close[0].title || close[0].path, text: title });
              localStorage.setItem('rm-bridge-queue', JSON.stringify(bq.slice(-3)));
            }
          }).catch(() => {});
        }
        if (text.length > 80) coreData = { noteRel, fm: {...fm}, body: text };
        flashMsg = 'kept as a note · ' + title;
      } else if (dest === 'dismiss') {
        flashMsg = 'dismissed';
      }
      await window.Bridge.capture.markDone(it.path);
    } catch (e) {
      console.debug('[triage]', e);
      window.flash?.('could not sort that one');
      return;
    }
    if (flashMsg) window.flash?.(flashMsg);
    if (coreData) { showCoreClaim(coreData); return; }
    queue.shift();
    renderTriage();
    loadInboxCount();
    if (window.loadThresholdCard) loadThresholdCard();
    if (dest === 'reading' && window.loadReadingsList) loadReadingsList();
    if (dest === 'bucket' && window.RM_loadCabinet) window.RM_loadCabinet();
  }

  // goal is interactive: mark sorted, close triage, open the forge prefilled
  async function sortToGoal() {
    const it = queue[0];
    if (!it) return;
    try { await window.Bridge.capture.markDone(it.path); }
    catch (e) { console.debug('[triage-goal]', e); window.flash?.('could not sort that one'); return; }
    const text = it.content || '';
    queue.shift();
    closeTriage();
    loadInboxCount();
    if (window.RM_openForge) window.RM_openForge(captureTitle(text));
  }

  bodyEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tri]');
    if (!btn) return;
    const act = btn.dataset.tri;
    if (act === 'close') { closeTriage(); return; }
    if (act === 'goal')  { sortToGoal(); return; }
    sortCurrent(act);
  });
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeTriage(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && scrim.classList.contains('on')) closeTriage(); });
  if (pill) {
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');
    pill.addEventListener('click', openTriage);
    pill.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTriage(); } });
  }
  window.openTriage = openTriage;
}

// ---- Loop 2: Resume Card — load from real vault ----
// the scribe greets by the hour — a resident voice, not a template
function salute() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11)  return 'Good morning.';
  if (h >= 11 && h < 17) return 'Good afternoon.';
  if (h >= 17 && h < 22) return 'Good evening.';
  return 'A late hour.';
}

async function loadThresholdCard() {
  try {
    const card = await window.Bridge.vault.pickOneThing();

    const tag = document.getElementById('resume-tag');
    const t = document.getElementById('resume-title');
    const m = document.getElementById('resume-meta');
    const whyRow = document.querySelector('.resume .why');
    const w = document.getElementById('resume-why');
    const n = document.getElementById('resume-next');
    const btn = document.getElementById('resume-reenter');
    const panel = document.querySelector('.resume');
    const scribe = document.getElementById('th-scribe');

    if (!card) {
      if (panel) panel.classList.remove('live');
      if (tag) tag.textContent = '⸻ the desk is clear ⸻';
      if (t) t.textContent = 'Nothing in motion yet';
      if (m) m.textContent = '';
      if (whyRow) whyRow.style.display = 'none';
      if (n) n.textContent = 'Open a reading, or forge a star — the first move is yours.';
      if (btn) btn.style.display = 'none';
      if (scribe) scribe.textContent = salute() + ' The desk is clear — begin wherever you like.';
      return;
    }

    if (tag) tag.textContent = '⸻ continue where you were ⸻';
    if (whyRow) whyRow.style.display = '';
    if (btn) btn.style.display = '';
    if (t) t.textContent = card.title;
    if (m) {
      const parts = [card.kind === 'reading' ? 'reading' : 'goal', card.warmth].filter(Boolean);
      m.textContent = parts.join(' · ');
    }
    if (w) w.textContent = card.why || '(no why recorded yet)';
    if (n) n.textContent = card.next_action;

    // Store path + kind on re-enter button so it can open the exact thing again
    if (btn) {
      btn.dataset.readingPath = card.path;
      btn.dataset.kind = card.kind || '';
    }

    if (panel) panel.classList.add('live');

    // Update scribe text to reflect the actual resume card
    if (scribe && card.title) {
      // the Threshold speaks identity: frame the one thing by its becoming
      let toward = '';
      if (card.kind === 'goal' && card.path) {
        try {
          const rel = toVaultRel(card.path);
          const n = rel ? await window.Bridge.notes.readParsed(rel) : null;
          toward = (n && n.frontmatter && n.frontmatter.becoming) || '';
        } catch (e) { /* the plain line still serves */ }
      }
      const base = card.kind === 'goal'
        ? `One rung waits on ${card.title}. Finish the thought.`
        : `You left ${card.title} mid-way. I'd begin there — the rest can keep.`;
      scribe.textContent = salute() + ' ' + (toward ? `Toward ${toward} — ` : '') + base.charAt(0)[toward ? 'toLowerCase' : 'toUpperCase']() + base.slice(1);
    }
  } catch(e) {
    console.debug('[threshold]', e);
  }
}
window.loadThresholdCard = loadThresholdCard;

// JS mirror of Rust's compute_score in vault.rs — warmth × log-decay over 14 days
function scoreItem(temp, lastTouched) {
  const w = temp === 'warm' ? 1.0 : temp === 'cooling' ? 0.7 : 0.4;
  if (!lastTouched) return w * 0.5;
  const days = Math.max(0, (Date.now() - new Date(lastTouched).getTime()) / 86400000);
  return w / (1.0 + Math.log1p(days) / Math.log1p(14));
}

// ---- Threshold: "on the ladder" — warmest active goal ----
async function loadThresholdGoal() {
  try {
    const files = await window.Bridge.vault.listFiles('Goals').catch(() => []);

    let best = null, bestScore = -Infinity;
    for (const f of (files || [])) {
      const rel  = 'Goals/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (!fm.title) continue;
      const rungs = Array.isArray(fm.rungs) ? fm.rungs : [];
      if (rungs.length > 0 && rungs.every(r => r.complete)) continue;
      const score = scoreItem(fm.temp || 'warm', fm.last_touched || fm.added || '');
      if (score > bestScore) { bestScore = score; best = fm; }
    }
    if (!best) {
      const t = document.getElementById('th-goal-title');
      const p = document.getElementById('th-goal-pos');
      const b = document.getElementById('th-goal-bar');
      const r = document.getElementById('th-goal-rung');
      if (t) t.textContent = 'No star charted yet';
      if (p) p.textContent = '';
      if (b) b.style.width = '0%';
      if (r) r.textContent = 'Open the Atlas and forge your first guiding star.';
      return;
    }

    const rungs = Array.isArray(best.rungs) ? best.rungs : [];
    const total = rungs.length;
    const done  = rungs.filter(r => r.complete).length;
    const cur   = rungs.find(r => !r.complete);

    const t = document.getElementById('th-goal-title');
    const p = document.getElementById('th-goal-pos');
    const b = document.getElementById('th-goal-bar');
    const r = document.getElementById('th-goal-rung');
    if (t) t.textContent = best.title;
    if (p) p.textContent = total ? `rung ${done + 1} of ${total}` : 'rungs not yet set';
    if (b) b.style.width = total ? `${Math.round(done / total * 100)}%` : '0%';
    if (r) r.textContent = cur ? (cur.t || cur.produce || 'continue') : 'All rungs complete.';
  } catch(e) { console.debug('[threshold-goal]', e); }
}
window.loadThresholdGoal = loadThresholdGoal;

// ---- Threshold: momentum line — most recently touched cooling / cold item ----
async function loadMomentumLine() {
  try {
    const files = await window.Bridge.vault.listFiles('Readings').catch(() => []);
    const el = document.getElementById('th-momentum');
    if (!el) return;

    let pick = null;
    for (const f of (files || [])) {
      const rel  = 'Readings/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.status === 'bound') continue;
      const temp = fm.temp || 'warm';
      if (temp !== 'cooling' && temp !== 'cold') continue;
      const last = fm.last_touched || fm.added || '';
      if (!pick || last > (pick.last || '')) pick = { title: fm.title || f.name, temp, last };
    }

    if (!pick) { el.hidden = true; return; }

    let ago = '';
    if (pick.last) {
      const days = Math.round((Date.now() - new Date(pick.last).getTime()) / 86400000);
      ago = days === 0 ? ' today' : days === 1 ? ' yesterday' : ` ${days} days ago`;
    }
    const dotCls = pick.temp === 'cold' ? 'cold' : 'cooling';
    const label  = pick.temp === 'cold' ? 'Cold' : 'Cooling';
    el.innerHTML = `<span class="dot ${dotCls}"></span> ${label} — <em>${escHtml(pick.title)}</em> last opened${ago}.`;
    el.hidden = false;
  } catch(e) { console.debug('[threshold-momentum]', e); }
}
window.loadMomentumLine = loadMomentumLine;

// ---- Life-maxxing: real re-entry rate ----
async function loadLifeStats() {
  try {
    const rate = await window.Bridge.stats.reentryRate(30);
    const el = document.getElementById('life-reentry');
    if (el && rate != null) el.innerHTML = `${Math.round(rate)}<small>%</small>`;
  } catch(e) { console.debug('[life-stats]', e); }

  // honest plates — every number below traces to a real file in the vault
  try {
    const monthAgo = addDaysISO(new Date().toISOString().slice(0, 10), -30);
    let passages = 0;
    let domains = {};   // domain -> touches in the last 30 days

    const rfiles = await window.Bridge.vault.listFiles('Readings').catch(() => []);
    for (const f of (rfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Readings/' + f.name + '.md').catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      passages += Array.isArray(fm.highlights) ? fm.highlights.length : 0;
      if ((fm.last_touched || '') >= monthAgo) {
        const d = (fm.domain || fm.thread || 'letters').toString().toLowerCase();
        domains[d] = (domains[d] || 0) + 1;
      }
    }
    const gfiles = await window.Bridge.vault.listFiles('Goals').catch(() => []);
    for (const f of (gfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Goals/' + f.name + '.md').catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.status === 'archived') continue;
      if ((fm.last_touched || '') >= monthAgo) {
        const d = (fm.domain || 'letters').toString().toLowerCase();
        domains[d] = (domains[d] || 0) + 1;
      }
    }
    let synth = 0;
    const nfiles = await window.Bridge.vault.listFiles('Notes').catch(() => []);
    for (const f of (nfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Notes/' + f.name + '.md').catch(() => null);
      if (note && note.frontmatter && note.frontmatter.type === 'synthesis') synth++;
    }

    const pEl = document.getElementById('life-passages');
    if (pEl) pEl.textContent = String(passages);
    const sEl = document.getElementById('life-synth');
    if (sEl) sEl.textContent = String(synth);

    const dEl = document.getElementById('life-depth');
    const dCap = document.getElementById('life-depth-c');
    const entries = Object.entries(domains).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);
    if (dEl && total > 0) {
      const deep = Math.round((entries[0][1] / total) * 10);
      dEl.innerHTML = deep + '<small>:' + (10 - deep) + '</small>';
      if (dCap) dCap.textContent = 'of the month’s attention, ' + deep + ' parts went to ' +
        entries[0][0] + (entries.length > 1 ? '; ' + (10 - deep) + ' to everything else.' : ' — a single-minded month.');
    } else if (dEl) {
      dEl.textContent = '—';
      if (dCap) dCap.textContent = 'nothing touched this month — the ledger is quiet, not broken.';
    }
  } catch(e) { console.debug('[life-stats-plates]', e); }
}
window.loadLifeStats = loadLifeStats;

// ---- The Wisdom Layer: the canon speaks, quietly, one line per room ----
// The owner's own kept passages remain the primary voice (the epigraph).
// The canon appears once per room, chosen by the day — never random on reload,
// never more than one line, never a notification. Wallpaper is the enemy.
const CANON = [
  { t: 'You have a right to your actions, but never to the fruits of your actions.', s: 'Bhagavad Gita · II.47', r: ['threshold', 'atlas'] },
  { t: 'Lift yourself by your own self; do not let yourself sink — for you alone are your own friend, and you alone your own enemy.', s: 'Bhagavad Gita · VI.5', r: ['life'] },
  { t: 'What is found here may be found elsewhere. What is not found here is nowhere.', s: 'Mahabharata · Adi Parva', r: ['reading'] },
  { t: 'You are what your deep, driving desire is. As your desire is, so is your will.', s: 'Brihadaranyaka Upanishad', r: ['atlas'] },
  { t: 'Waste no more time arguing what a good man should be. Be one.', s: 'Marcus Aurelius · Meditations X', r: ['life', 'observatory'] },
  { t: 'Confine yourself to the present.', s: 'Marcus Aurelius · Meditations VII', r: ['threshold'] },
  { t: 'It is not that we have a short time to live, but that we waste much of it.', s: 'Seneca · On the Shortness of Life', r: ['life'] },
  { t: 'Learning never exhausts the mind.', s: 'Leonardo da Vinci', r: ['reading'] },
  { t: 'Obstacles cannot crush me. Every obstacle yields to stern resolve.', s: 'Leonardo da Vinci', r: ['atlas'] },
  { t: 'There is no greatness where there is no simplicity, goodness and truth.', s: 'Tolstoy', r: ['observatory'] },
  { t: 'Above all, do not lie to yourself.', s: 'Dostoevsky · The Brothers Karamazov', r: ['observatory'] },
  { t: 'Knowledge is of no value unless you put it into practice.', s: 'Chekhov', r: ['life'] },
  { t: 'I have always imagined that Paradise will be a kind of library.', s: 'Borges', r: ['reading'] },
  { t: 'Whatever you can do, or dream you can, begin it. Boldness has genius, power, and magic in it.', s: 'attr. Goethe', r: ['threshold', 'cabinet'] },
  { t: 'Within you there is a stillness and a sanctuary to which you can retreat at any time and be yourself.', s: 'Hesse · Siddhartha', r: ['threshold', 'cabinet'] },
];
function seedCanon() {
  // The commonplace inversion (VISION.md): the owner's own kept passages are
  // the voice of the palace. The canon speaks only in the reflective room —
  // one line, chosen by the day — and at thresholds (seasons, the letter).
  const dayN = Math.floor(Date.now() / 86400000);   // changes at midnight, stable all day
  document.querySelectorAll('.room').forEach(room => {
    const id = room.id;
    if (id !== 'observatory') return;
    const pool = CANON.filter(q => q.r.includes(id));
    if (!pool.length) return;
    const q = pool[dayN % pool.length];
    let el = room.querySelector('.canon');
    if (!el) {
      el = document.createElement('p');
      el.className = 'canon';
      const rule = room.querySelector('.gold-rule');
      if (rule && rule.parentNode) rule.parentNode.insertBefore(el, rule.nextSibling);
      else room.appendChild(el);
    }
    el.innerHTML = '<span class="cq">”' + escHtml(q.t) + '”</span><span class="cs">— ' + escHtml(q.s) + '</span>';
  });
}
seedCanon();

// ---- The Living Sky: the palace knows the real season and hour ----
// Like the enchanted ceiling — opened at midnight in December, it IS
// midnight in December. Subtle to the point of deniability.
function liveSky() {
  const h = new Date().getHours(), m = new Date().getMonth();
  const daypart = (h >= 5 && h < 11) ? 'dawn' : (h >= 11 && h < 17) ? 'day' : (h >= 17 && h < 22) ? 'dusk' : 'night';
  const season = (m >= 2 && m <= 4) ? 'spring' : (m >= 5 && m <= 7) ? 'summer' : (m >= 8 && m <= 10) ? 'autumn' : 'winter';
  document.documentElement.dataset.daypart = daypart;
  document.documentElement.dataset.season = season;
}
liveSky();
setInterval(liveSky, 15 * 60 * 1000);   // re-checked four times an hour; no loop, no cost

// ---- Phase G: the temporal mirror — weekly shape · annual letter · seasons ----
function isoWeek(d) {
  d = d || new Date();
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, '0');
}

async function loadTemporalMirror() {
  if (!window.Bridge) return;
  const today = new Date().toISOString().slice(0, 10);
  // weekly shape — already set down this week?
  try {
    const wk = isoWeek();
    const note = await window.Bridge.notes.readParsed('Journal/weekly-' + wk + '.md').catch(() => null);
    const form = document.getElementById('ws-form'), done = document.getElementById('ws-done');
    if (note && form && done) {
      form.style.display = 'none'; done.style.display = '';
      const fm = note.frontmatter || {};
      document.getElementById('ws-done-text').textContent =
        'The week is set down. You committed: ”' + (fm.commit || '—') + '” — it returns in ninety days.';
    } else if (form && done) { form.style.display = ''; done.style.display = 'none'; }
  } catch (e) { console.debug('[weekly-load]', e); }
  // annual letter — sealed this year?
  try {
    const yr = new Date().getFullYear();
    const note = await window.Bridge.notes.readParsed('Journal/letter-' + yr + '.md').catch(() => null);
    const form = document.getElementById('al-form'), done = document.getElementById('al-done');
    if (note && form && done) {
      form.style.display = 'none'; done.style.display = '';
      const due = (note.frontmatter && note.frontmatter.review && note.frontmatter.review.due) || (yr + 1) + '-01-01';
      document.getElementById('al-done-text').textContent =
        'A letter is sealed. It opens ' + due + '. Until then, not even you may read it here.';
    } else if (form && done) { form.style.display = ''; done.style.display = 'none'; }
  } catch (e) { console.debug('[letter-load]', e); }
  // seasonal reckoning — only in the closing fortnight of a quarter, once
  try {
    const d = new Date(), m = d.getMonth(), q = Math.floor(m / 3) + 1;
    const qEndMonth = q * 3 - 1;
    const qEnd = new Date(d.getFullYear(), qEndMonth + 1, 0);
    const daysLeft = Math.ceil((qEnd - d) / 86400000);
    const panel = document.getElementById('season-panel');
    if (panel && daysLeft <= 14) {
      const rel = 'Journal/season-' + d.getFullYear() + '-Q' + q + '.md';
      const existing = await window.Bridge.notes.readParsed(rel).catch(() => null);
      panel.style.display = existing ? 'none' : '';
      panel.dataset.rel = rel;
    } else if (panel) panel.style.display = 'none';
  } catch (e) { console.debug('[season-load]', e); }
}
window.loadTemporalMirror = loadTemporalMirror;

{
  const today = () => new Date().toISOString().slice(0, 10);
  document.getElementById('ws-save')?.addEventListener('click', async () => {
    const moved = (document.getElementById('ws-moved')?.value || '').trim();
    const alive = (document.getElementById('ws-alive')?.value || '').trim();
    const commit = (document.getElementById('ws-commit')?.value || '').trim();
    const putdown = (document.getElementById('ws-putdown')?.value || '').trim();
    if (!moved && !commit) { window.flash?.('a line for what moved, or a commit — one is enough'); return; }
    const wk = isoWeek();
    try {
      await window.Bridge.notes.create('Journal', 'weekly-' + wk, {
        type: 'weekly', week: wk, created: today(),
        moved, alive_to: alive, commit, put_down: putdown,
        review: { due: addDaysISO(today(), 90), interval: 90 },
      }, '');
      window.flash?.('the week is set down · it returns in ninety days');
      loadTemporalMirror();
    } catch (e) { console.debug('[weekly-save]', e); window.flash?.('the codex would not take it'); }
  });
  document.getElementById('al-save')?.addEventListener('click', async () => {
    const text = (document.getElementById('al-text')?.value || '').trim();
    if (!text) { window.flash?.('the letter is empty'); return; }
    const yr = new Date().getFullYear();
    try {
      await window.Bridge.notes.create('Journal', 'letter-' + yr, {
        type: 'letter', created: today(),
        review: { due: addDaysISO(today(), 365), interval: 365 },
      }, text);
      window.flash?.('sealed · it opens when the year turns');
      loadTemporalMirror();
    } catch (e) { console.debug('[letter-save]', e); window.flash?.('the seal would not set'); }
  });
  document.getElementById('sn-save')?.addEventListener('click', async () => {
    const name = (document.getElementById('sn-name')?.value || '').trim();
    if (!name) { window.flash?.('a season needs its name'); return; }
    const note = (document.getElementById('sn-note')?.value || '').trim();
    const rel = document.getElementById('season-panel')?.dataset.rel || '';
    const slug = rel.replace(/^Journal\//, '').replace(/\.md$/, '');
    try {
      await window.Bridge.notes.create('Journal', slug, {
        type: 'season', name, created: today(),
      }, note);
      window.flash?.('so it is named · ' + name);
      loadTemporalMirror();
    } catch (e) { console.debug('[season-save]', e); }
  });
}

// ---- Phase F: the Exhibition — works of the hand ----
async function RM_loadWorks() {
  const grid = document.getElementById('works-grid');
  if (!grid || !window.Bridge) return;
  try {
    const files = await window.Bridge.vault.listFiles('Works').catch(() => []);
    const works = [];
    for (const f of (files || [])) {
      const note = await window.Bridge.notes.readParsed('Works/' + f.name + '.md').catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.type !== 'work') continue;
      works.push({ fm, body: note.body || '' });
    }
    if (!works.length) {
      grid.innerHTML = '<p class="empty-note">The gallery stands empty — which is not shame, but invitation. The first work goes here.</p>';
      return;
    }
    works.sort((a, b) => ((b.fm.created || '') < (a.fm.created || '') ? -1 : 1));
    grid.innerHTML = works.map(w => {
      const fm = w.fm;
      return '<div class="work-card">' +
        '<div class="wk-kind">' + escHtml(fm.kind || 'work') + '</div>' +
        '<div class="wk-title">' + escHtml(fm.title || 'untitled') + '</div>' +
        (fm.what ? '<div class="wk-what">' + escHtml(fm.what) + '</div>' : '') +
        '<div class="wk-meta">' + escHtml(fm.domain || '') + (fm.created ? ' · ' + escHtml(fm.created) : '') + '</div>' +
        '</div>';
    }).join('');
  } catch (e) { console.debug('[works]', e); }
}
window.RM_loadWorks = RM_loadWorks;

{
  const scrim = document.getElementById('work-scrim');
  document.getElementById('work-add')?.addEventListener('click', () => {
    scrim.classList.add('on');
    setTimeout(() => document.getElementById('wk-title')?.focus(), 60);
  });
  document.getElementById('wk-cancel')?.addEventListener('click', () => scrim.classList.remove('on'));
  scrim?.addEventListener('click', e => { if (e.target === scrim) scrim.classList.remove('on'); });
  document.getElementById('wk-save')?.addEventListener('click', async () => {
    const title = (document.getElementById('wk-title')?.value || '').trim();
    if (!title) { window.flash?.('a work needs its name'); return; }
    const kind = document.getElementById('wk-kind')?.value || 'essay';
    const domain = (document.getElementById('wk-domain')?.value || '').trim().toLowerCase();
    const what = (document.getElementById('wk-what')?.value || '').trim();
    const today = new Date().toISOString().slice(0, 10);
    const slug = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 6).join('-') || ('work-' + Date.now());
    try {
      await window.Bridge.notes.create('Works', slug, {
        type: 'work', title, kind, domain, what, created: today,
      }, '');
      scrim.classList.remove('on');
      ['wk-title', 'wk-domain', 'wk-what'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      window.flash?.('hung in the gallery · ' + title.slice(0, 50));
      RM_loadWorks(); RM_loadDepth();
    } catch (e) { console.debug('[work-save]', e); window.flash?.('the gallery would not take it'); }
  });
}

// ---- Phase F: the Depth Ledger — gathered · practiced · made, per domain ----
async function RM_loadDepth() {
  const el = document.getElementById('depth-ledger');
  if (!el || !window.Bridge) return;
  try {
    // domain -> { gathered, practiced, made } — every count traces to a file
    const D = {};
    const bump = (dom, k, n) => {
      const d = (dom || '').toString().trim().toLowerCase();
      if (!d) return;
      D[d] = D[d] || { gathered: 0, practiced: 0, made: 0 };
      D[d][k] += n;
    };

    const gfiles = await window.Bridge.vault.listFiles('Goals').catch(() => []);
    for (const f of (gfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Goals/' + f.name + '.md').catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.status === 'archived') continue;
      bump(fm.domain, 'gathered', 1);
      const rungs = Array.isArray(fm.rungs) ? fm.rungs : [];
      bump(fm.domain, 'practiced', rungs.filter(r => r && r.complete).length);
      if (fm.kind === 'habit') bump(fm.domain, 'practiced', (fm.habit_log || []).length);
    }
    const rfiles = await window.Bridge.vault.listFiles('Readings').catch(() => []);
    for (const f of (rfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Readings/' + f.name + '.md').catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.domain) {
        bump(fm.domain, 'gathered', 1);
        bump(fm.domain, 'gathered', Array.isArray(fm.highlights) ? fm.highlights.length : 0);
      }
    }
    const wfiles = await window.Bridge.vault.listFiles('Works').catch(() => []);
    for (const f of (wfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Works/' + f.name + '.md').catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.type === 'work') bump(fm.domain || 'letters', 'made', 1);
    }

    const rows = Object.entries(D).sort((a, b) =>
      (b[1].made - a[1].made) || (b[1].practiced - a[1].practiced) || (b[1].gathered - a[1].gathered));
    if (!rows.length) {
      el.innerHTML = '<p class="empty-note" style="padding:16px">The ledger fills itself from the vault — domains appear as you work in them.</p>';
      return;
    }
    let h = '<div class="dl-head"><div>domain</div><div>gathered</div><div>practiced</div><div>made</div></div>';
    for (const [dom, c] of rows) {
      h += '<div class="dl-row"><div class="dl-domain">' + escHtml(dom) + '</div>' +
        '<div class="dl-num' + (c.gathered ? '' : ' zero') + '">' + c.gathered + '</div>' +
        '<div class="dl-num' + (c.practiced ? '' : ' zero') + '">' + c.practiced + '</div>' +
        '<div class="dl-num made' + (c.made ? '' : ' zero') + '">' + c.made + '</div></div>';
    }
    el.innerHTML = h;
  } catch (e) { console.debug('[depth]', e); }
}
window.RM_loadDepth = RM_loadDepth;

// ---- The Index (Ctrl+P): every door in the palace, one keystroke away ----
const PAL_ROOMS = [
  ['threshold', 'the Threshold', 'I'], ['reading', 'the Reading Room', 'II'],
  ['atlas', 'the Atlas', 'III'], ['life', 'Life-maxxing', 'IV'],
  ['cabinet', 'the Cabinet', 'V'], ['observatory', 'the Observatory', 'VI'],
  ['study', 'the Study', 'VII'],
];
let palItems = [], palSel = 0;

async function buildPalItems() {
  const items = PAL_ROOMS.map(r => ({ kind: 'room', label: r[1], meta: 'plate ' + r[2], go: () => window.go(r[0]) }));
  if (!window.Bridge) return items;
  const scan = async (sub, fn) => {
    const files = await window.Bridge.vault.listFiles(sub).catch(() => []);
    for (const f of (files || [])) {
      const rel = sub + '/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (note) fn(rel, note.frontmatter || {});
    }
  };
  await Promise.all([
    scan('Readings', (rel, fm) => { if (fm.title) items.push({ kind: 'book', label: fm.title, meta: fm.status || '', go: () => { window.go('reading'); window.openReadingCard?.(rel, fm); } }); }),
    scan('Goals', (rel, fm) => { if (fm.title && fm.status !== 'archived') items.push({ kind: 'star', label: fm.title, meta: fm.domain || '', go: () => { window.go('atlas'); window.RM_selectGoalByPath?.(rel); } }); }),
    scan('Threads', (rel, fm) => { if (fm.question) items.push({ kind: 'thread', label: fm.question, meta: fm.status || '', go: () => window.RM_openThreadsSheet?.() }); }),
    scan('Bucket', (rel, fm) => { if (fm.title) items.push({ kind: 'wish', label: fm.title, meta: fm.status || '', go: () => window.go('cabinet') }); }),
    scan('Works', (rel, fm) => { if (fm.title) items.push({ kind: 'work', label: fm.title, meta: fm.kind || '', go: () => window.go('life') }); }),
    scan('Notes', (rel, fm) => { if (fm.title || fm.kind) items.push({ kind: 'leaf', label: fm.title || rel.split('/').pop().replace(/\.md$/, ''), meta: fm.kind || 'note', go: () => { window.go('study'); setTimeout(() => window.RM_openNote?.(rel), 120); } }); }),
  ]).catch(() => {});
  return items;
}

function palRender() {
  const list = document.getElementById('pal-list');
  const q = (document.getElementById('pal-input')?.value || '').trim().toLowerCase();
  if (!list) return;
  let shown = palItems;
  if (q) {
    shown = palItems.filter(it => it.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.label.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.label.toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs;
      });
  }
  shown = shown.slice(0, 12);
  palSel = Math.min(palSel, Math.max(0, shown.length - 1));
  list.innerHTML = shown.length
    ? shown.map((it, i) =>
        '<div class="pal-item' + (i === palSel ? ' on' : '') + '" data-i="' + i + '">' +
        '<span class="pk">' + it.kind + '</span><span class="pt">' + escHtml(it.label) + '</span>' +
        '<span class="pm">' + escHtml(it.meta || '') + '</span></div>').join('')
    : '<p class="pal-none">Nothing in the index answers to that.</p>';
  list.dataset.count = shown.length;
  list._shown = shown;
  Array.from(list.querySelectorAll('.pal-item')).forEach(el => {
    el.addEventListener('click', () => palGo(+el.dataset.i));
    el.addEventListener('mousemove', () => { palSel = +el.dataset.i; palRender(); });
  });
}
function palGo(i) {
  const it = document.getElementById('pal-list')?._shown?.[i];
  closePalette();
  if (it) try { it.go(); } catch (e) { console.debug('[palette]', e); }
}
function openPalette() {
  const scrim = document.getElementById('palette-scrim');
  if (!scrim) return;
  scrim.classList.add('on');
  const inp = document.getElementById('pal-input');
  if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 40); }
  palSel = 0;
  palItems = PAL_ROOMS.map(r => ({ kind: 'room', label: r[1], meta: 'plate ' + r[2], go: () => window.go(r[0]) }));
  palRender();
  buildPalItems().then(items => { palItems = items; palRender(); });
}
function closePalette() { document.getElementById('palette-scrim')?.classList.remove('on'); }
{
  const scrim = document.getElementById('palette-scrim');
  scrim?.addEventListener('click', e => { if (e.target === scrim) closePalette(); });
  document.getElementById('pal-input')?.addEventListener('input', () => { palSel = 0; palRender(); });
  document.getElementById('pal-input')?.addEventListener('keydown', e => {
    const n = +(document.getElementById('pal-list')?.dataset.count || 0);
    if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palSel + 1, n - 1); palRender(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(palSel - 1, 0); palRender(); }
    else if (e.key === 'Enter') { e.preventDefault(); palGo(palSel); }
    else if (e.key === 'Escape') { closePalette(); }
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); openPalette(); }
    // number keys walk the plates — never while writing
    if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-7]$/.test(e.key)) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const room = PAL_ROOMS[+e.key - 1];
      if (room && window.go) window.go(room[0]);
    }
  });
}

// ---- the ascent: real feats, gathered from the vault ----
async function RM_loadFeats() {
  const el = document.getElementById('feats-list');
  if (!el || !window.Bridge) return;
  try {
    const feats = [];
    const scan = async (sub, fn) => {
      const files = await window.Bridge.vault.listFiles(sub).catch(() => []);
      for (const f of (files || [])) {
        const note = await window.Bridge.notes.readParsed(sub + '/' + f.name + '.md').catch(() => null);
        if (note) fn(note.frontmatter || {});
      }
    };
    await scan('Bucket', fm => { if (fm.status === 'attained' && fm.title) feats.push({ d: fm.attained_on || '', t: fm.title, k: 'attained' }); });
    await scan('Readings', fm => { if (fm.status === 'bound' && fm.title) feats.push({ d: fm.bound_on || '', t: 'Finished & bound · ' + fm.title, k: 'knowledge' }); });
    await scan('Works', fm => { if (fm.type === 'work' && fm.title) feats.push({ d: fm.created || '', t: fm.title, k: fm.kind || 'work' }); });
    await scan('Goals', fm => {
      if (fm.status === 'archived') return;
      (Array.isArray(fm.rungs) ? fm.rungs : []).forEach(r => {
        if (r && r.complete && r.t) feats.push({ d: '', t: 'Cleared the rung · “' + r.t + '”', k: 'mastery' });
      });
      if (fm.kind === 'habit' && (fm.best_streak || 0) >= 7)
        feats.push({ d: '', t: (fm.best_streak) + '-day streak · ' + (fm.title || ''), k: 'discipline' });
    });
    if (!feats.length) {
      el.innerHTML = '<p class="empty-note">No feats yet in the ledger — bind a book, clear a rung, attain a wish, hang a work. They gather here on their own.</p>';
      return;
    }
    feats.sort((a, b) => (b.d || '') < (a.d || '') ? -1 : 1);
    el.innerHTML = feats.slice(0, 9).map(f => {
      const d = f.d ? f.d.slice(5) : '·';
      return '<div class="feat"><span class="fd">' + escHtml(d) + '</span><span class="ft">' + escHtml(f.t) + '</span><span class="fk">' + escHtml(f.k) + '</span></div>';
    }).join('');
  } catch (e) { console.debug('[feats]', e); }
}
window.RM_loadFeats = RM_loadFeats;

// ---- your one life, in days — counted from a birthdate the vault keeps ----
async function RM_loadLifeDays() {
  const ask = document.getElementById('life-days-ask'), show = document.getElementById('life-days-show');
  if (!ask || !show || !window.Bridge) return;
  const render = (birth) => {
    const lived = Math.floor((Date.now() - new Date(birth + 'T00:00:00').getTime()) / 86400000);
    if (!(lived > 0 && lived < 45000)) return false;
    const remain = Math.max(0, 30000 - lived);
    document.getElementById('ld-lived').innerHTML =
      lived.toLocaleString() + ' <span style="font-family:var(--sc);font-size:12.5px;letter-spacing:.1em;color:var(--ink-3)">lived · ~' + remain.toLocaleString() + ' remain</span>';
    document.getElementById('ld-bar').setAttribute('width', String(Math.min(280, Math.round((lived / 30000) * 280))));
    ask.style.display = 'none'; show.style.display = '';
    return true;
  };
  try {
    const note = await window.Bridge.notes.readParsed('Body/vitals.md').catch(() => null);
    const birth = note && note.frontmatter && note.frontmatter.birthdate;
    if (birth && render(birth)) return;
  } catch (e) {}
  ask.style.display = ''; show.style.display = 'none';
  document.getElementById('ld-save')?.addEventListener('click', async () => {
    const birth = document.getElementById('ld-birth')?.value;
    if (!birth) return;
    try {
      const existing = await window.Bridge.notes.readParsed('Body/vitals.md').catch(() => null);
      if (existing) {
        const fm = existing.frontmatter || {}; fm.birthdate = birth;
        await window.Bridge.notes.write('Body/vitals.md', fm, existing.body || '');
      } else {
        await window.Bridge.notes.create('Body', 'vitals', { type: 'vitals', birthdate: birth }, '');
      }
      render(birth);
      window.flash?.('the count begins — spend them on purpose');
    } catch (e) { console.debug('[vitals]', e); }
  }, { once: true });
}
window.RM_loadLifeDays = RM_loadLifeDays;

// ---- Threshold: daily tasks checklist ----
let taskCache = [];

async function loadTasks() {
  if (!window.Bridge) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const files = await window.Bridge.vault.listFiles('Journal/tasks').catch(() => []);
    taskCache = [];
    for (const f of (files || [])) {
      const rel  = 'Journal/tasks/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.type !== 'task' || fm.status === 'done') continue;
      const due = fm.due || today;
      if (due > today) continue;
      const order = (typeof fm.order === 'number') ? fm.order : 1e9;
      taskCache.push({ rel, title: fm.title || f.name, due, order, overdue: due < today });
    }
    taskCache.sort((a, b) => (a.order - b.order) || a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
    renderTaskList();
  } catch(e) { console.debug('[tasks]', e); }
}
window.loadTasks = loadTasks;

function renderTaskList() {
  // both the Threshold and the Study show the same day's tasks
  const lists = document.querySelectorAll('.task-list');
  if (!lists.length) return;
  const html = !taskCache.length
    ? '<li class="task-empty">nothing pending ❧</li>'
    : taskCache.map((t, i) =>
        `<li class="task-item" data-idx="${i}">` +
        `<input type="checkbox" class="task-cb" aria-label="complete task" data-rel="${escHtml(t.rel)}">` +
        `<span class="task-lbl" title="click to amend">${escHtml(t.title)}</span>` +
        (t.overdue ? `<span class="task-overdue">carried forward</span>` : '') +
        `<span class="task-tools">` +
        `<button class="task-tool" data-move="up"${i === 0 ? ' disabled' : ''} title="move up" aria-label="move task up">↑</button>` +
        `<button class="task-tool" data-move="down"${i === taskCache.length - 1 ? ' disabled' : ''} title="move down" aria-label="move task down">↓</button>` +
        `<button class="task-tool del" data-del title="set aside — kept in .trash" aria-label="remove task">×</button>` +
        `</span></li>`
      ).join('');
  lists.forEach(l => { l.innerHTML = html; });
  if (window.RM_updateStir) window.RM_updateStir();
}

// read-modify-write a single frontmatter patch onto a task file
async function patchTask(rel, patch) {
  const note = await window.Bridge.notes.readParsed(rel);
  const fm = Object.assign({}, (note && note.frontmatter) || {}, patch);
  await window.Bridge.notes.write(rel, fm, (note && note.body) || '');
}

// reorder: swap in the cache immediately, then settle every order number
// so files that predate ordering fall into line too
async function moveTask(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= taskCache.length) return;
  const moved = taskCache.splice(i, 1)[0];
  taskCache.splice(j, 0, moved);
  renderTaskList();
  window.RM_haptic && window.RM_haptic(8);
  try {
    await Promise.all(taskCache.map((t, k) => {
      if (t.order === k + 1) return null;
      t.order = k + 1;
      return patchTask(t.rel, { order: k + 1 });
    }).filter(Boolean));
  } catch (e) { console.debug('[task move]', e); }
}

// amend a task's wording in place — Enter keeps it, Esc lets it be
function editTaskInline(li, i) {
  const t = taskCache[i]; if (!t) return;
  const lbl = li.querySelector('.task-lbl');
  if (!lbl || li.querySelector('.task-edit')) return;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'task-edit'; inp.value = t.title; inp.maxLength = 120;
  lbl.replaceWith(inp);
  inp.focus(); inp.select();
  let settled = false;
  const finish = async (keep) => {
    if (settled) return; settled = true;
    const val = inp.value.trim();
    if (keep && val && val !== t.title) {
      t.title = val;
      try { await patchTask(t.rel, { title: val }); } catch (e) { console.debug('[task edit]', e); }
    }
    renderTaskList();
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
}

async function addTask(title) {
  if (!title.trim() || !window.Bridge) return;
  const today = new Date().toISOString().slice(0, 10);
  const base  = today + '-' + title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const nextOrder = taskCache.reduce((m, t) => Math.max(m, t.order < 1e9 ? t.order : 0), 0) + 1;
  const fm    = { type: 'task', title: title.trim(), due: today, status: 'open', created: today, order: nextOrder };
  for (let i = 0; i < 4; i++) {
    const slug = i === 0 ? base : base + '-' + Math.random().toString(36).slice(2, 5);
    try { await window.Bridge.notes.create('Journal/tasks', slug, fm, ''); break; }
    catch(e) { if (String(e).indexOf('already exists') === -1) break; }
  }
  await loadTasks();
}

// ---- Threshold fold: one thing first (§2 First Law) ----
// The hearth pushes one object; the ladder, the rabbit hole, and the day's
// tasks wait behind a quiet line. Folded on every fresh arrival; the choice
// to unfold holds for the session only.
{
  const stir = document.getElementById('th-stir');
  const rest = document.getElementById('th-rest');
  const txt  = document.getElementById('th-stir-txt');
  window.RM_updateStir = function () {
    if (!txt || !rest) return;
    if (!rest.hidden) { txt.textContent = 'enough — let them rest'; return; }
    const n = taskCache.length;
    txt.textContent = n
      ? 'three other things stir — ' + n + ' task' + (n === 1 ? '' : 's') + ' pending among them'
      : 'three other things stir — look when you’re ready';
  };
  function setFold(open) {
    if (!rest) return;
    rest.hidden = !open;
    if (stir) stir.setAttribute('aria-expanded', open ? 'true' : 'false');
    try { sessionStorage.setItem('rm-th-fold', open ? 'open' : 'shut'); } catch (e) {}
    window.RM_updateStir();
  }
  if (stir && rest) {
    stir.addEventListener('click', () => setFold(rest.hidden));
    try { if (sessionStorage.getItem('rm-th-fold') === 'open') setFold(true); } catch (e) {}
  }
  window.RM_thUnfold = () => setFold(true);
  window.RM_updateStir();
}

// wire every task panel (Threshold + Study): submit to add, checkbox to complete
document.querySelectorAll('.task-add').forEach((form) => {
  const input = form.querySelector('input');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    await addTask(val);
  });
});
document.querySelectorAll('.task-list').forEach((list) => {
  // instruments: reorder, set aside, amend in place
  list.addEventListener('click', async (e) => {
    const li = e.target.closest('.task-item'); if (!li) return;
    const i = +li.dataset.idx;
    const mv = e.target.closest('[data-move]');
    if (mv && !mv.disabled) { moveTask(i, mv.dataset.move === 'up' ? -1 : 1); return; }
    if (e.target.closest('[data-del]')) {
      const t = taskCache[i]; if (!t) return;
      li.classList.add('gone');
      window.RM_haptic && window.RM_haptic(11);
      try { await window.Bridge.notes.trash(t.rel); } catch (err) { console.debug('[task del]', err); }
      window.flash && window.flash('set aside · ' + t.title);
      await loadTasks();
      return;
    }
    if (e.target.closest('.task-lbl')) editTaskInline(li, i);
  });
  list.addEventListener('change', async (e) => {
    const cb = e.target.closest('.task-cb');
    if (!cb || !cb.dataset.rel) return;
    const rel = cb.dataset.rel;
    cb.closest('.task-item')?.classList.add('done');
    window.RM_haptic && window.RM_haptic(11);
    setTimeout(async () => {
      try {
        const note = await window.Bridge.notes.readParsed(rel);
        const fm   = Object.assign({}, (note && note.frontmatter) || {}, { status: 'done' });
        await window.Bridge.notes.write(rel, fm, (note && note.body) || '');
      } catch(e) { console.debug('[task-done]', e); }
      await loadTasks();
    }, 450);
  });
});

// Ctrl+T → focus task input (jump to Threshold first if needed)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
    e.preventDefault();
    go('threshold');
    if (window.RM_thUnfold) window.RM_thUnfold();
    setTimeout(() => document.getElementById('task-add-input')?.focus(), 80);
  }
});

// ---- VII · THE STUDY — the commonplace book (Notes/*.md, freely written) ----
{
  const KINDS = ['note', 'plan', 'idea', 'log', 'daily'];
  let studyNotes = [], studyFilter = 'all', studySearch = '', studyCurrent = null;
  let saveTimer = null, previewOn = false, linkIndex = {};
  const $s = (id) => document.getElementById(id);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const dailyRel = (iso) => 'Notes/daily-' + iso + '.md';

  const noteKind = (fm) => {
    const k = (fm && fm.kind) || '';
    if (KINDS.indexOf(k) >= 0) return k;
    return 'note';
  };
  const firstLine = (body) => {
    const t = String(body || '').replace(/^#+\s*/gm, '').replace(/[*_>#]/g, '').trim();
    return t.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 2).join(' ');
  };

  // — the weave: every [[Title]] in every note's body, indexed for resolution + backlinks —
  function buildLinkIndex() {
    linkIndex = {};
    const wikiRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    studyNotes.forEach((n) => {
      let m;
      wikiRe.lastIndex = 0;
      while ((m = wikiRe.exec(n.body || ''))) {
        const key = m[1].trim().toLowerCase();
        if (!key) continue;
        if (!linkIndex[key]) linkIndex[key] = [];
        if (linkIndex[key].indexOf(n) === -1) linkIndex[key].push(n);
      }
    });
  }
  window.RM_wikiResolve = function (target) {
    const key = String(target || '').trim().toLowerCase();
    if (!key) return null;
    const byTitle = studyNotes.find(n => (n.title || '').trim().toLowerCase() === key);
    if (byTitle) return byTitle;
    const byFile = studyNotes.find(n => n.rel.split('/').pop().replace(/\.md$/, '').toLowerCase() === key);
    return byFile || null;
  };
  function backlinksFor(note) {
    const key = (note.title || '').trim().toLowerCase();
    const fileKey = note.rel.split('/').pop().replace(/\.md$/, '').toLowerCase();
    const hits = (linkIndex[key] || []).concat(fileKey !== key ? (linkIndex[fileKey] || []) : []);
    const seen = {}, out = [];
    hits.forEach((n) => { if (n.rel !== note.rel && !seen[n.rel]) { seen[n.rel] = true; out.push(n); } });
    return out;
  }

  window.RM_loadStudy = async function () {
    if (!window.Bridge || !window.Bridge.vault) return;
    try {
      const files = await window.Bridge.vault.listFiles('Notes').catch(() => []);
      const rows = await Promise.all((files || []).map(async (f) => {
        const rel = 'Notes/' + f.name + '.md';
        const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
        if (!note) return null;
        const fm = note.frontmatter || {};
        return { rel, fm, body: note.body || '', mtime: f.mtime || 0,
                 title: fm.title || f.name, kind: noteKind(fm) };
      }));
      studyNotes = rows.filter(Boolean).sort((a, b) => b.mtime - a.mtime);
      buildLinkIndex();
      renderIndex();
      // the room may have just become visible — settle the open page's height
      if (studyCurrent && !previewOn) { syncDeco(); autoGrow(); }
    } catch (e) { console.debug('[study]', e); }
  };

  function renderIndex() {
    const idx = $s('note-index'); if (!idx) return;
    const q = studySearch.toLowerCase();
    const shown = studyNotes.filter(n =>
      (studyFilter === 'all' || n.kind === studyFilter) &&
      (!q || (n.title + ' ' + n.body).toLowerCase().indexOf(q) >= 0));
    // today's daily leaf, if it exists, always leads — a running scratch surface
    const todayRel = dailyRel(todayISO());
    const ti = shown.findIndex(n => n.rel === todayRel);
    if (ti > 0) shown.unshift(shown.splice(ti, 1)[0]);
    if (!shown.length) {
      idx.innerHTML = '<div class="note-index-empty">' +
        (studyNotes.length ? 'no leaf matches — clear the search.' : 'the desk is clear — begin a note.') + '</div>';
      return;
    }
    idx.innerHTML = shown.map(n =>
      '<button class="note-card' + (n.rel === studyCurrent ? ' sel' : '') + '" data-rel="' + escHtml(n.rel) + '">' +
        '<div class="nc-top"><span class="nc-kind">' + escHtml(n.kind) + '</span>' +
        '<span class="nc-date">' + escHtml(n.fm.updated || n.fm.created || '') + '</span></div>' +
        '<div class="nc-title">' + escHtml(n.title || 'untitled') + '</div>' +
        (firstLine(n.body) ? '<div class="nc-snip">' + escHtml(firstLine(n.body)) + '</div>' : '') +
      '</button>').join('');
    idx.querySelectorAll('.note-card').forEach(c =>
      c.addEventListener('click', () => openNote(c.dataset.rel)));
  }

  function openNote(rel) {
    const n = studyNotes.find(x => x.rel === rel); if (!n) return;
    studyCurrent = rel;
    $s('note-desk-empty').style.display = 'none';
    $s('note-editor').style.display = 'block';
    $s('ne-title').value = n.title === n.rel.split('/').pop().replace(/\.md$/, '') && !n.fm.title ? '' : (n.fm.title || '');
    $s('ne-kind').value = n.kind;
    $s('ne-body').value = n.body;
    setPreview(false);
    $s('ne-status').textContent = 'opened';
    $s('study-wrap').classList.add('showing-desk');
    renderBacklinks(n);
    renderIndex();
  }

  function renderBacklinks(n) {
    const wrap = $s('ne-backlinks'), list = $s('ne-bl-list'), count = $s('ne-bl-count');
    if (!wrap || !list || !count) return;
    const links = backlinksFor(n);
    if (!links.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    list.style.display = 'none';
    count.textContent = '(' + links.length + ')';
    list.innerHTML = links.map(l =>
      '<button class="ne-bl-item" data-rel="' + escHtml(l.rel) + '">' + escHtml(l.title || 'untitled') + '</button>').join('');
    list.querySelectorAll('.ne-bl-item').forEach(b =>
      b.addEventListener('click', () => openNote(b.dataset.rel)));
  }

  function collectAndSave() {
    const n = studyNotes.find(x => x.rel === studyCurrent); if (!n) return;
    const title = $s('ne-title').value.trim();
    const kind = $s('ne-kind').value;
    const body = $s('ne-body').value;
    n.title = title || (n.rel.split('/').pop().replace(/\.md$/, '')); n.kind = kind; n.body = body;
    $s('ne-status').textContent = 'saving…';
    const fm = Object.assign({}, n.fm, { type: 'note', kind, title: title,
      updated: new Date().toISOString().slice(0, 10) });
    if (!fm.created) fm.created = fm.updated;
    n.fm = fm;
    window.Bridge.notes.write(n.rel, fm, body)
      .then(() => { $s('ne-status').textContent = 'kept ✦'; buildLinkIndex(); renderIndex(); if (n.rel === studyCurrent) renderBacklinks(n); })
      .catch((e) => { $s('ne-status').textContent = 'not kept'; console.debug('[study save]', e); });
  }
  function queueSave() {
    $s('ne-status').textContent = 'writing…';
    clearTimeout(saveTimer); saveTimer = setTimeout(collectAndSave, 650);
  }

  // — the living page: decorate the markdown in place as it is written —
  // Only metric-safe styling, so the caret and the letters never part ways.
  function decoMd(src) {
    let h = escHtml(src || '');
    h = h.replace(/^(#{1,4})( [^\n]*)$/gm, '<span class="dc-h"><span class="dc-m">$1</span>$2</span>');
    h = h.replace(/^(&gt;)( ?[^\n]*)$/gm, '<span class="dc-q"><span class="dc-m">$1</span>$2</span>');
    h = h.replace(/^([-*])( )/gm, '<span class="dc-mark">$1</span>$2');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<span class="dc-m">**</span><span class="dc-b">$1</span><span class="dc-m">**</span>');
    h = h.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (m, pre, txt) =>
      pre + '<span class="dc-m">*</span><span class="dc-i">' + txt + '</span><span class="dc-m">*</span>');
    h = h.replace(/`([^`\n]+)`/g, '<span class="dc-m">`</span><span class="dc-c">$1</span><span class="dc-m">`</span>');
    h = h.replace(/\[\[([^\]\n]+)\]\]/g, '<span class="dc-m">[[</span><span class="dc-w">$1</span><span class="dc-m">]]</span>');
    return h + '\n';
  }
  function syncDeco() {
    const d = $s('ne-deco'), b = $s('ne-body');
    if (d && b) d.innerHTML = decoMd(b.value);
  }
  // the page grows with the writing — no inner scrollbar to fight the overlay
  function autoGrow() {
    const b = $s('ne-body'); if (!b) return;
    b.style.height = 'auto';
    // hidden room → zero scrollHeight; leave the CSS min-height in charge
    if (b.scrollHeight) b.style.height = b.scrollHeight + 'px'; else b.style.height = '';
  }

  function setPreview(on) {
    previewOn = on;
    const wrap2 = $s('ne-body-wrap'), body = $s('ne-body'), rend = $s('ne-rendered'), btn = $s('ne-preview');
    if (on) { rend.innerHTML = mdLite(body.value); rend.style.display = 'block'; wrap2.style.display = 'none'; btn.classList.add('on'); btn.textContent = 'write'; }
    else { rend.style.display = 'none'; wrap2.style.display = 'block'; syncDeco(); autoGrow(); btn.classList.remove('on'); btn.textContent = 'read'; }
  }

  async function newNote(kind, presetTitle) {
    if (!window.Bridge) { window.flash && window.flash('the desk needs the app'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const base = kind + '-' + today + '-' + Math.random().toString(36).slice(2, 6);
    const fm = { type: 'note', kind, title: presetTitle || '', created: today, updated: today };
    try {
      const rel = await window.Bridge.notes.create('Notes', base, fm, '');
      await window.RM_loadStudy();
      openNote(rel || ('Notes/' + base + '.md'));
      if (presetTitle) { window.flash && window.flash('a fresh leaf for “' + presetTitle + '”'); }
      else { setTimeout(() => $s('ne-title').focus(), 60); window.flash && window.flash('a fresh ' + kind + ' — write freely'); }
    } catch (e) { console.debug('[study new]', e); window.flash && window.flash('the leaf would not open'); }
  }

  // the daily leaf: open today's, or begin it — a running scratch surface
  async function openOrCreateDaily() {
    if (!window.Bridge) { window.flash && window.flash('the desk needs the app'); return; }
    const iso = todayISO(), rel = dailyRel(iso);
    if (!studyNotes.find(n => n.rel === rel)) await window.RM_loadStudy();
    const existing = studyNotes.find(n => n.rel === rel);
    if (existing) { openNote(rel); return; }
    const pretty = new Date(iso + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const fm = { type: 'note', kind: 'daily', title: 'Today · ' + pretty, created: iso, updated: iso };
    try {
      const created = await window.Bridge.notes.create('Notes', 'daily-' + iso, fm, '');
      await window.RM_loadStudy();
      openNote(created || rel);
      setTimeout(() => $s('ne-body').focus(), 60);
      window.flash && window.flash('a fresh page for today');
    } catch (e) { console.debug('[study daily]', e); window.flash && window.flash('the leaf would not open'); }
  }

  // open a specific leaf from the Index (loads the desk first if needed)
  window.RM_openNote = async function (rel) {
    if (!studyNotes.find(n => n.rel === rel)) await window.RM_loadStudy();
    openNote(rel);
  };

  // wiring (elements exist at load; the room is hidden until entered)
  const wrap = $s('study-wrap');
  if (wrap) {
    $s('ne-title').addEventListener('input', queueSave);
    $s('ne-body').addEventListener('input', queueSave);
    $s('ne-body').addEventListener('input', () => { syncDeco(); autoGrow(); });
    window.addEventListener('resize', () => { if (studyCurrent && !previewOn) autoGrow(); });
    $s('ne-kind').addEventListener('change', collectAndSave);

    // the split control: ⌄ unfolds the other kinds of leaf
    const moreBtn = $s('note-new-more'), kindMenu = $s('kind-menu');
    if (moreBtn && kindMenu) {
      const closeMenu = () => { kindMenu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); };
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        kindMenu.hidden = !kindMenu.hidden;
        moreBtn.setAttribute('aria-expanded', kindMenu.hidden ? 'false' : 'true');
      });
      kindMenu.addEventListener('click', closeMenu);
      document.addEventListener('click', (e) => { if (!kindMenu.hidden && !kindMenu.contains(e.target) && e.target !== moreBtn) closeMenu(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !kindMenu.hidden) closeMenu(); });
    }
    $s('ne-preview').addEventListener('click', () => setPreview(!previewOn));
    $s('ne-back').addEventListener('click', () => { wrap.classList.remove('showing-desk'); });
    $s('ne-del').addEventListener('click', async () => {
      if (!studyCurrent) return;
      if (!confirm('Move this leaf to the trash? It is kept in .trash, never destroyed.')) return;
      try { await window.Bridge.notes.trash(studyCurrent); } catch (e) { console.debug('[study trash]', e); }
      studyCurrent = null;
      $s('note-editor').style.display = 'none';
      $s('note-desk-empty').style.display = 'block';
      wrap.classList.remove('showing-desk');
      await window.RM_loadStudy();
      window.flash && window.flash('the leaf is set aside');
    });
    $s('note-new-note').addEventListener('click', () => newNote('note'));
    document.querySelectorAll('[data-newkind]').forEach(b =>
      b.addEventListener('click', () => newNote(b.dataset.newkind)));
    $s('note-new-today').addEventListener('click', openOrCreateDaily);
    document.querySelectorAll('#study-filter .sfchip').forEach(chip =>
      chip.addEventListener('click', () => {
        studyFilter = chip.dataset.kind;
        document.querySelectorAll('#study-filter .sfchip').forEach(c =>
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
        renderIndex();
      }));
    $s('study-search').addEventListener('input', (e) => { studySearch = e.target.value; renderIndex(); });

    // — a resolved [[link]] opens its leaf; an unmade one offers to begin it —
    $s('ne-rendered').addEventListener('click', (e) => {
      const a = e.target.closest('.wikilink'); if (!a) return;
      e.preventDefault();
      if (a.classList.contains('unmade')) {
        const title = a.dataset.noteTitle || '';
        if (confirm('No leaf named “' + title + '” yet. Begin it?')) newNote('note', title);
      } else if (a.dataset.noteRel) { openNote(a.dataset.noteRel); }
    });
    $s('ne-bl-toggle').addEventListener('click', () => {
      const l = $s('ne-bl-list'); if (l) l.style.display = (l.style.display === 'none') ? 'flex' : 'none';
    });

    // — [[wikilink autocomplete: type [[ and pick an existing leaf —
    const wikiAc = $s('wiki-ac');
    let acItems = [], acSel = -1;
    const acHide = () => { if (wikiAc) { wikiAc.style.display = 'none'; wikiAc.innerHTML = ''; } acItems = []; acSel = -1; };
    const acHighlight = () => { wikiAc.querySelectorAll('.wiki-ac-item').forEach((el, i) => el.classList.toggle('sel', i === acSel)); };
    const acPick = (i) => {
      const n = acItems[i], neBody = $s('ne-body'); if (!n || !neBody) return;
      const caret = neBody.selectionStart, text = neBody.value;
      const m = text.slice(0, caret).match(/\[\[([^\[\]]*)$/);
      if (!m) { acHide(); return; }
      const start = caret - m[0].length, insert = '[[' + (n.title || '') + ']]';
      neBody.value = text.slice(0, start) + insert + text.slice(caret);
      const newCaret = start + insert.length;
      neBody.selectionStart = neBody.selectionEnd = newCaret;
      acHide(); neBody.focus(); syncDeco(); autoGrow(); queueSave();
    };
    const acRender = (q) => {
      const query = q.toLowerCase();
      acItems = studyNotes.filter(n => n.rel !== studyCurrent && (!query || (n.title || '').toLowerCase().indexOf(query) >= 0)).slice(0, 6);
      if (!acItems.length) {
        wikiAc.innerHTML = '<div class="wiki-ac-empty">no matching leaf yet — keep typing, then close with ]]</div>';
        wikiAc.style.display = 'block'; acSel = -1; return;
      }
      wikiAc.innerHTML = acItems.map((n, i) =>
        '<div class="wiki-ac-item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' + escHtml(n.title || 'untitled') + '</div>').join('');
      wikiAc.style.display = 'block'; acSel = 0;
      wikiAc.querySelectorAll('.wiki-ac-item').forEach(el =>
        el.addEventListener('mousedown', (e) => { e.preventDefault(); acPick(+el.dataset.i); }));
    };
    const neBodyEl = $s('ne-body');
    if (neBodyEl && wikiAc) {
      neBodyEl.addEventListener('input', () => {
        const m = neBodyEl.value.slice(0, neBodyEl.selectionStart).match(/\[\[([^\[\]]*)$/);
        if (!m) { acHide(); return; }
        acRender(m[1]);
      });
      neBodyEl.addEventListener('keydown', (e) => {
        if (!wikiAc || wikiAc.style.display !== 'block') return;
        if (e.key === 'ArrowDown') { e.preventDefault(); acSel = Math.min(acItems.length - 1, acSel + 1); acHighlight(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); acSel = Math.max(0, acSel - 1); acHighlight(); }
        else if (e.key === 'Enter' && acSel >= 0 && acItems.length) { e.preventDefault(); acPick(acSel); }
        else if (e.key === 'Escape') { acHide(); }
      });
      neBodyEl.addEventListener('blur', () => setTimeout(acHide, 120));
    }
  }
}

// ---- Mobile: relocate the theme toggle + inbox count out of .spine ----
// .spine has backdrop-filter, which makes it a containing block for its
// position:fixed descendants — a naive top-right CSS placement ends up
// measured from .spine's own (bottom-anchored) box, not the viewport. So on
// phones these two are physically moved to a new element on <body> instead;
// they keep their existing click handlers since appendChild doesn't touch listeners.
(function () {
  const lamp = document.getElementById('lamp');
  const pill = document.getElementById('inboxpill');
  const spineFoot = document.querySelector('.spine-foot');
  if (!lamp || !pill || !spineFoot) return;
  const mobileFoot = document.createElement('div');
  mobileFoot.id = 'mobile-foot';
  let placed = false;
  function place(mobile) {
    if (mobile && !placed) {
      mobileFoot.appendChild(pill);
      mobileFoot.appendChild(lamp);
      document.body.appendChild(mobileFoot);
      placed = true;
    } else if (!mobile && placed) {
      spineFoot.insertBefore(pill, spineFoot.firstChild);
      spineFoot.appendChild(lamp);
      mobileFoot.remove();
      placed = false;
    }
  }
  const mq = window.matchMedia('(max-width:640px)');
  place(mq.matches);
  if (mq.addEventListener) mq.addEventListener('change', (e) => place(e.matches));
  else mq.addListener((e) => place(e.matches));
})();

// ---- Mobile motion & navigation: swipe plates · hardware back · sheet dismiss ----
(function () {
  const isMobile = () => window.matchMedia('(max-width:640px)').matches;
  const ORDER = window.RM_ROOM_ORDER || [];

  function closeSheet(s) {
    s.classList.remove('on');
    const sheet = s.firstElementChild; if (sheet) sheet.style.transform = '';
  }

  // 1 · swipe left/right across the plates
  const leaf = document.querySelector('.leaf');
  if (leaf) {
    let sx = 0, sy = 0, tracking = false, decided = false, horiz = false;
    const noSwipe = (el) => {
      for (let n = el; n && n !== leaf; n = n.parentElement) {
        if (!n.classList) continue;
        if (n.tagName === 'TEXTAREA' || n.tagName === 'INPUT' ||
            n.classList.contains('chart-frame') || n.classList.contains('study-filter') ||
            n.classList.contains('habit-cal') || n.classList.contains('note-index') ||
            n.classList.contains('shelf-books') || n.classList.contains('intents')) return true;
        const ox = n.scrollWidth - n.clientWidth;
        if (ox > 6 && getComputedStyle(n).overflowX !== 'visible') return true;
      }
      return false;
    };
    leaf.addEventListener('touchstart', (e) => {
      if (!isMobile() || e.touches.length !== 1 || document.querySelector('.scrim.on')) { tracking = false; return; }
      if (noSwipe(e.target)) { tracking = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; decided = false; horiz = false;
    }, { passive: true });
    leaf.addEventListener('touchmove', (e) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (!decided && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) { decided = true; horiz = Math.abs(dx) > Math.abs(dy) * 1.3; }
    }, { passive: true });
    leaf.addEventListener('touchend', (e) => {
      if (!tracking || !horiz) { tracking = false; return; }
      const dx = e.changedTouches[0].clientX - sx; tracking = false;
      if (Math.abs(dx) < 60) return;
      const i = ORDER.indexOf(window.RM_curRoom || 'threshold');
      const ni = dx < 0 ? Math.min(ORDER.length - 1, i + 1) : Math.max(0, i - 1);
      if (ni !== i) { window.go(ORDER[ni]); window.RM_haptic && window.RM_haptic(8); }
    }, { passive: true });
  }

  // 2 · hardware back button (Android) — a self-healing back-trap
  if (isMobile()) {
    const rearm = () => { try { history.pushState({ rmTrap: 1 }, ''); } catch (e) {} };
    rearm();
    window.addEventListener('popstate', () => {
      const s = document.querySelector('.scrim.on');
      if (s) { closeSheet(s); rearm(); window.RM_haptic && window.RM_haptic(8); return; }
      const wrap = document.getElementById('study-wrap');
      if (wrap && wrap.classList.contains('showing-desk') && window.RM_curRoom === 'study') {
        wrap.classList.remove('showing-desk'); rearm(); return;
      }
      const hist = window.RM_roomHist || [];
      if (hist.length > 1) { hist.pop(); window.go(hist[hist.length - 1], true); rearm(); return; }
      history.back(); // nothing left to handle — let the app close
    });
  }

  // 3 · drag a bottom sheet down to dismiss it
  document.querySelectorAll('.scrim').forEach((scrim) => {
    const sheet = scrim.firstElementChild; if (!sheet) return;
    let y0 = 0, dragging = false, dy = 0;
    sheet.addEventListener('touchstart', (e) => {
      if (!isMobile() || e.touches.length !== 1 || sheet.scrollTop > 0) { dragging = false; return; }
      y0 = e.touches[0].clientY; dragging = true; dy = 0;
    }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0) { scrim.classList.add('dragging'); sheet.style.transform = 'translateY(' + dy + 'px)'; }
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
      if (!dragging) return; dragging = false;
      scrim.classList.remove('dragging');
      if (dy > 90) { sheet.style.transform = ''; scrim.classList.remove('on'); window.RM_haptic && window.RM_haptic(8); }
      else { sheet.style.transform = ''; }
    }, { passive: true });
  });
})();

// ---- Threshold: epigraph — one real highlight quote + attribution ----
async function loadEpigraph() {
  const qEl = document.getElementById('th-epi-q');
  const sEl = document.getElementById('th-epi-src');
  if (!qEl || !sEl || !window.Bridge) return;
  try {
    const files = await window.Bridge.vault.listFiles('Readings').catch(() => []);
    let best = null;
    for (const f of (files || [])) {
      const note = await window.Bridge.notes.readParsed('Readings/' + f.name + '.md').catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      const hls = Array.isArray(fm.highlights) ? fm.highlights : [];
      for (const h of hls) {
        const quote = (h.anchor && h.anchor.quote) || h.quote || '';
        if (!quote) continue;
        const created = h.created || '';
        if (!best || created > best.created)
          best = { quote, why: h.why || '', title: fm.title || f.name, created };
      }
    }
    if (!best) {
      qEl.textContent = '“The page is blank — for now.”';
      sEl.textContent = '';
      return;
    }
    qEl.textContent = '“' + best.quote + '”';
    sEl.textContent = '— from ' + best.title;
  } catch(e) { console.debug('[epigraph]', e); }
}
window.loadEpigraph = loadEpigraph;

// ---- Threshold: rabbit hole — one queued/cold reading, rotated daily ----
async function loadRabbitHole() {
  const titleEl = document.getElementById('th-rabbit-title');
  const metaEl  = document.getElementById('th-rabbit-meta');
  const btn     = document.getElementById('th-rabbit-btn');
  if (!titleEl || !window.Bridge) return;
  try {
    const files = await window.Bridge.vault.listFiles('Readings').catch(() => []);
    const pool = [];
    for (const f of (files || [])) {
      const rel  = 'Readings/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.status === 'reading' || fm.status === 'bound') continue;
      if (!fm.title) continue;
      pool.push({ title: fm.title, thread: fm.thread || '', added: fm.added || '', rel, fm });
    }
    if (!pool.length) {
      titleEl.textContent = 'No queued readings yet';
      if (metaEl) metaEl.textContent = 'drop a PDF or URL into the Reading Room to begin';
      if (btn) btn.style.display = 'none';
      return;
    }
    if (btn) btn.style.display = '';
    // Deterministic daily rotation — feels curated, not random
    const day = Math.floor(Date.now() / 86400000);
    const pick = pool[day % pool.length];
    titleEl.textContent = pick.title;
    if (metaEl) metaEl.textContent = (pick.thread || 'reading') + ' · queued';
    if (btn) {
      btn.addEventListener('click', () => {
        go('reading');
        if (window.openReadingCard) window.openReadingCard(pick.rel, pick.fm);
      }, { once: true });
    }
  } catch(e) { console.debug('[rabbit-hole]', e); }
}
window.loadRabbitHole = loadRabbitHole;

// ---- Threshold: intentions ribbon — warmest goal rung + today's workout ----
async function loadIntentions() {
  const iWrap = document.getElementById('intents');
  if (!iWrap || !window.Bridge) return;
  try {
    Array.from(iWrap.querySelectorAll('.intent')).forEach(el => el.remove());
    const items = [];
    const dow = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];

    // Warmest goal's next incomplete rung
    const gfiles = await window.Bridge.vault.listFiles('Goals').catch(() => []);
    let bestGoal = null, bestScore = -Infinity;
    for (const f of (gfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Goals/' + f.name + '.md').catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (!fm.title) continue;
      const rungs = Array.isArray(fm.rungs) ? fm.rungs : [];
      const cur = rungs.find(r => !r.complete);
      if (!cur) continue;
      const sc = scoreItem(fm.temp || 'warm', fm.last_touched || fm.added || '');
      if (sc > bestScore) { bestScore = sc; bestGoal = { title: fm.title, rung: cur.t || cur.produce || 'next rung' }; }
    }
    if (bestGoal) items.push(bestGoal.rung + ' · ' + bestGoal.title);

    // Today's workout session from split
    const split = await window.Bridge.notes.readParsed('Body/split.md').catch(() => null);
    if (split) {
      const week = (split.frontmatter || {}).week || {};
      const session = week[dow];
      if (session) items.push(session + ' day · training table');
    }

    items.forEach(text => {
      const s = document.createElement('span');
      s.className = 'intent';
      s.textContent = text;
      iWrap.appendChild(s);
    });
  } catch(e) { console.debug('[intentions]', e); }
}
window.loadIntentions = loadIntentions;

// ---- B3: The Observatory — an honest weekly review (Janus, two-faced) ----
// Everything here is DERIVED from the real vault, or shown as a calm empty state.
// Honest scope limit: rung/attainment events aren't timestamped, so "the ladder"
// and "wishes attained" reflect current state, not strict this-week history.
async function loadObservatory() {
  const scribe = document.getElementById('obs-scribe');
  const panel  = document.getElementById('obs-lines');
  if (!panel || !window.Bridge) return;
  try {
    const weekAgoMs = Date.now() - 7 * 86400000;
    const within = (iso) => { if (!iso) return false; const t = new Date(iso).getTime(); return !isNaN(t) && t >= weekAgoMs; };

    // Readings — touched this week, highlights kept this week, temperature spread
    let readingsTouched = [], highlightsKept = 0, warm = 0, cooling = 0, cold = 0;
    const rfiles = await window.Bridge.vault.listFiles('Readings').catch(() => []);
    for (const f of (rfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Readings/' + f.name + '.md').catch(() => null);
      const fm = note && note.frontmatter; if (!fm) continue;
      if (within(fm.last_touched || fm.added)) readingsTouched.push(fm.title || f.name);
      const hls = Array.isArray(fm.highlights) ? fm.highlights : [];
      highlightsKept += hls.filter(h => within(h.created)).length;
      if (fm.status !== 'bound') {
        const t = fm.temp || 'warm';
        if (t === 'cold') cold++; else if (t === 'cooling') cooling++; else warm++;
      }
    }

    // Goals — warmest active goal + its current rung (state-based)
    let ladder = null, gBest = -Infinity;
    const gfiles = await window.Bridge.vault.listFiles('Goals').catch(() => []);
    for (const f of (gfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Goals/' + f.name + '.md').catch(() => null);
      const fm = note && note.frontmatter; if (!fm || !fm.title) continue;
      if ((fm.status || '') === 'archived') continue;
      const rungs = Array.isArray(fm.rungs) ? fm.rungs : [];
      if (rungs.length && rungs.every(r => r.complete)) continue;
      const score = scoreItem(fm.temp || 'warm', fm.last_touched || fm.added || '');
      if (score > gBest) {
        gBest = score;
        const done = rungs.filter(r => r.complete).length, cur = rungs.find(r => !r.complete);
        ladder = { title: fm.title, done, total: rungs.length, rung: cur ? (cur.t || cur.produce || '') : '' };
      }
    }

    // Bucket — wishes attained (state-based)
    let attained = 0, bucketTotal = 0;
    const bfiles = await window.Bridge.vault.listFiles('Bucket').catch(() => []);
    for (const f of (bfiles || [])) {
      const note = await window.Bridge.notes.readParsed('Bucket/' + f.name + '.md').catch(() => null);
      const fm = note && note.frontmatter; if (!fm || (fm.type || 'bucket') !== 'bucket') continue;
      bucketTotal++; if (fm.status === 'attained') attained++;
    }

    // Body — sessions logged this week + latest bodyweight
    let sessions = 0, lastBw = null, lastBwDate = '';
    const bodyFiles = await window.Bridge.vault.listFiles('Body').catch(() => []);
    for (const f of (bodyFiles || [])) {
      if (f.name === 'exercises' || f.name === 'split') continue;
      const note = await window.Bridge.notes.readParsed('Body/' + f.name + '.md').catch(() => null);
      const fm = note && note.frontmatter; if (!fm || fm.type !== 'workout') continue;
      if (within(fm.date)) sessions++;
      if (fm.bodyweight != null && String(fm.date) > lastBwDate) { lastBw = fm.bodyweight; lastBwDate = String(fm.date); }
    }

    // Re-entry — the headline metric, real
    let rate = null; try { rate = await window.Bridge.stats.reentryRate(30); } catch (e) {}

    // ---- the lines · only those with something true to say ----
    const lines = [];
    if (readingsTouched.length)
      lines.push(['went deeper', readingsTouched.slice(0, 3).map(escHtml).join(' · ') + (readingsTouched.length > 3 ? ` · +${readingsTouched.length - 3} more` : '')]);
    if (highlightsKept)
      lines.push(['kept', highlightsKept + ' passage' + (highlightsKept === 1 ? '' : 's') + ' — each with its “why”']);
    if (ladder)
      lines.push(['on the ladder', escHtml(ladder.title) + (ladder.total ? ` — rung ${ladder.done + 1} of ${ladder.total}` : '') + (ladder.rung ? `: ${escHtml(ladder.rung)}` : '')]);
    if (sessions || lastBw != null)
      lines.push(['the body', (sessions ? `${sessions} session${sessions === 1 ? '' : 's'} logged` : 'no sessions this week') + (lastBw != null ? ` · bodyweight ${escHtml(lastBw)}` : '')]);
    if (attained)
      lines.push(['wishes attained', attained + ' of ' + bucketTotal + ' in the cabinet']);
    if (warm || cooling || cold)
      lines.push(['the threads', `${warm} warm · ${cooling} cooling · ${cold} cold`]);
    if (rate != null)
      lines.push(['re-entry · 30 days', Math.round(rate) + '% of what you let fall, you returned to']);

    const corners = '<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>';
    panel.innerHTML = corners + (lines.length
      ? lines.map(([k, v]) => `<div class="line"><span class="ok">${k}</span><span class="ov">${v}</span></div>`).join('')
      : '<div class="line"><span class="ov" style="font-style:italic">A quiet week — nothing pressed, nothing lost. The codex kept its place.</span></div>');

    if (scribe) {
      if (!lines.length) {
        scribe.textContent = 'A still week. The hearth was banked and the books waited — that is allowed. Come back when you will; nothing was lost.';
      } else {
        const bits = [];
        if (readingsTouched.length) bits.push(`returned to ${readingsTouched.length} reading${readingsTouched.length === 1 ? '' : 's'}`);
        if (highlightsKept)         bits.push(`kept ${highlightsKept} passage${highlightsKept === 1 ? '' : 's'}`);
        if (sessions)               bits.push(`logged ${sessions} session${sessions === 1 ? '' : 's'}`);
        if (attained)               bits.push(`attained ${attained} wish${attained === 1 ? '' : 'es'}`);
        let s = bits.length ? ('This week you ' + bits.join(', ') + '.') : 'A measured week.';
        if (cooling || cold) s += ` ${cooling + cold} thread${(cooling + cold) === 1 ? '' : 's'} cooled — an invitation, not a failure.`;
        scribe.textContent = s;
      }
    }
  } catch (e) { console.debug('[observatory]', e); }
}
window.loadObservatory = loadObservatory;

// ---- Loop 4 (cont.): Resurfacing — Mnemosyne returns one kept passage ----
// Highlights live in each reading's frontmatter `highlights[]`, each carrying a
// `review:{due,interval}`. We surface exactly ONE whose due date has arrived (§4
// one thing), with the quote + the why. "It still holds" doubles the interval;
// "let it rest" pushes it a month out. Nothing due → the card stays hidden.
function addDaysISO(iso, n) {
  const d = iso ? new Date(iso + 'T00:00:00') : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---- Phase E: The Thread — the living inquiry (seal · rekindle · position) ----
// One-ask budget: only one unbidden ask (seal / rekindle / resurface / bridge)
// appears per session. Answering an ask releases the budget for the follow-up.
// RM_askOwner keeps re-runs idempotent: a loader may re-claim its own ask.
window.RM_askUsed = false;
window.RM_askOwner = null;
function askFreeFor(owner) { return !window.RM_askUsed || window.RM_askOwner === owner; }
function claimAsk(owner)   { window.RM_askUsed = true; window.RM_askOwner = owner; }
function releaseAsk()      { window.RM_askUsed = false; window.RM_askOwner = null; }

let tcCurrent = null;   // { rel, fm } of the thread shown on the card
const SEAL_AFTER_DAYS = 7;

function daysSinceISO(iso) {
  if (!iso) return 9999;
  const then = new Date(iso + 'T00:00:00');
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

function threadSlug(q) {
  const s = (q || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    .split(/\s+/).slice(0, 6).join('-');
  return s || ('thread-' + Date.now());
}

async function loadThreadCard() {
  const card = document.getElementById('thread-card');
  if (!card || !window.Bridge) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const files = await window.Bridge.vault.listFiles('Threads').catch(() => []);
    const threads = [];
    for (const f of (files || [])) {
      const rel = 'Threads/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.type !== 'thread') continue;
      threads.push({ rel, fm, body: note.body || '' });
    }

    // priority: 1 · a fallow thread whose return is due (rekindle — an ask)
    //           2 · a burning thread gone quiet (sealing — an ask)
    //           3 · the warmest burning thread (the one thing — not an ask)
    let mode = null, pick = null;

    const dueFallow = threads.filter(t => t.fm.status === 'fallow'
      && t.fm.review && t.fm.review.due && t.fm.review.due <= today)
      .sort((a, b) => (a.fm.review.due < b.fm.review.due ? -1 : 1));
    const cooling = threads.filter(t => t.fm.status === 'burning'
      && daysSinceISO(t.fm.last_touched) >= SEAL_AFTER_DAYS);
    const burning = threads.filter(t => t.fm.status === 'burning')
      .sort((a, b) => ((b.fm.last_touched || '') < (a.fm.last_touched || '') ? -1 : 1));

    if (dueFallow.length && askFreeFor('thread'))    { mode = 'rekindle'; pick = dueFallow[0]; claimAsk('thread'); }
    else if (cooling.length && askFreeFor('thread')) { mode = 'seal';     pick = cooling[0];   claimAsk('thread'); }
    else if (burning.length)                         { mode = 'burning';  pick = burning[0]; }

    const tag = document.getElementById('tc-tag');
    const qEl = document.getElementById('tc-question');
    const gripRow = document.getElementById('tc-grip-row');
    const stanceRow = document.getElementById('tc-stance-row');
    const burnBox = document.getElementById('tc-burning');
    const sealBox = document.getElementById('tc-sealing');
    const rekBox = document.getElementById('tc-rekindle');
    const posBox = document.getElementById('tc-position');

    if (!pick) {
      // quiet invitation — a door, never a nag
      tcCurrent = null;
      burnBox.style.display = 'none'; sealBox.style.display = 'none';
      rekBox.style.display = 'none';  posBox.style.display = 'none';
      gripRow.style.display = 'none'; stanceRow.style.display = 'none';
      const asleep = threads.filter(t => t.fm.status === 'fallow').length;
      if (asleep > 0) {
        tag.textContent = '⸻ the threads sleep ⸻';
        qEl.innerHTML = '<span style="font-style:italic;font-size:17px;color:var(--ink-2)">' +
          asleep + ' thread' + (asleep === 1 ? ' lies' : 's lie') +
          ' fallow. They will return when their season comes.</span>';
      } else {
        tag.textContent = '⸻ no thread is open ⸻';
        qEl.innerHTML = '<span style="font-style:italic;font-size:17px;color:var(--ink-2)">A mind is measured by the questions it keeps alive.</span>';
      }
      card.hidden = false;
      return;
    }
    tcCurrent = pick;

    const fm = pick.fm;

    qEl.textContent = fm.question || '(an unnamed question)';
    const grip = fm.gripped || '';
    document.getElementById('tc-grip').textContent = grip;
    gripRow.style.display = grip ? '' : 'none';

    const positions = Array.isArray(fm.position) ? fm.position : [];
    const lastPos = positions.length ? positions[positions.length - 1] : null;
    if (lastPos && lastPos.stance) {
      document.getElementById('tc-stance').textContent = lastPos.stance;
      stanceRow.style.display = '';
    } else stanceRow.style.display = 'none';

    burnBox.style.display = 'none'; sealBox.style.display = 'none';
    rekBox.style.display = 'none';  posBox.style.display = 'none';

    if (mode === 'burning') {
      tag.textContent = '⸻ the thread you are pulling ⸻';
      document.getElementById('tc-probe').textContent = fm.next_probe || 'follow where it leads';
      burnBox.style.display = '';
    } else if (mode === 'seal') {
      tag.textContent = '⸻ this thread is going to sleep ⸻';
      document.getElementById('tc-stood').value = '';
      document.getElementById('tc-believed').value = '';
      document.getElementById('tc-wouldtry').value = '';
      sealBox.style.display = '';
    } else if (mode === 'rekindle') {
      tag.textContent = '⸻ a thread returns from the dark ⸻';
      const seals = Array.isArray(fm.sealed) ? fm.sealed : [];
      const cap = seals.length ? seals[seals.length - 1] : null;
      const capEl = document.getElementById('tc-capsule');
      if (cap) {
        capEl.innerHTML =
          '<span class="cap-lbl">you stood —</span> ' + escHtml(cap.stood || '…') + '<br>' +
          '<span class="cap-lbl">you believed —</span> ' + escHtml(cap.believed || '…') + '<br>' +
          '<span class="cap-lbl">you meant to try —</span> ' + escHtml(cap.would_try || '…');
      } else {
        capEl.innerHTML = '<span class="cap-lbl">sealed without a capsule — it kept its silence.</span>';
      }
      rekBox.style.display = '';
    }
    card.hidden = false;
  } catch (e) { console.debug('[thread-card]', e); card.hidden = true; }
}
window.loadThreadCard = loadThreadCard;

async function saveThreadFm(mutate) {
  if (!tcCurrent) return;
  const note = await window.Bridge.notes.readParsed(tcCurrent.rel).catch(() => null);
  if (!note) return;
  const fm = note.frontmatter || {};
  mutate(fm);
  await window.Bridge.notes.write(tcCurrent.rel, fm, note.body || '');
  window.RM_loadThreadsIntoSky?.();   // the sky mirrors every movement of a thread
}

{
  const today = () => new Date().toISOString().slice(0, 10);

  // burning: pull the thread — touch it, keep it warm
  document.getElementById('tc-advance')?.addEventListener('click', async () => {
    await saveThreadFm(fm => { fm.last_touched = today(); });
    window.flash?.('the thread is warm — go where it leads');
    loadThreadCard();
  });

  // sealing: three lines, then it sleeps
  document.getElementById('tc-seal')?.addEventListener('click', async () => {
    const stood = document.getElementById('tc-stood').value.trim();
    const believed = document.getElementById('tc-believed').value.trim();
    const wouldTry = document.getElementById('tc-wouldtry').value.trim();
    await saveThreadFm(fm => {
      const seals = Array.isArray(fm.sealed) ? fm.sealed : [];
      seals.push({ date: today(), stood, believed, would_try: wouldTry });
      fm.sealed = seals;
      fm.status = 'fallow';
      fm.review = { due: addDaysISO(today(), 21), interval: 21 };
    });
    window.flash?.('sealed · it will return when its season comes');
    loadThreadCard();
  });
  document.getElementById('tc-still-burning')?.addEventListener('click', async () => {
    await saveThreadFm(fm => { fm.last_touched = today(); });
    window.flash?.('still burning');
    releaseAsk();
    loadThreadCard();
  });

  // rekindling: the capsule has done its work
  document.getElementById('tc-rekindle-btn')?.addEventListener('click', async () => {
    await saveThreadFm(fm => {
      fm.status = 'burning';
      fm.last_touched = today();
      delete fm.review;
    });
    window.flash?.('rekindled ✦');
    releaseAsk();
    loadThreadCard();
  });
  document.getElementById('tc-sleep-btn')?.addEventListener('click', async () => {
    await saveThreadFm(fm => {
      const cur = (fm.review && fm.review.interval) || 21;
      const interval = Math.min(Math.round(cur * 1.6), 120);
      fm.review = { due: addDaysISO(today(), interval), interval };
    });
    window.flash?.('it sleeps on');
    releaseAsk();
    loadThreadCard();
  });

  // position: the record of a changing mind (append-only)
  document.getElementById('tc-update-pos')?.addEventListener('click', () => {
    const box = document.getElementById('tc-position');
    box.style.display = box.style.display === 'none' ? '' : 'none';
    if (box.style.display !== 'none') document.getElementById('tc-stance-in').focus();
  });
  document.getElementById('tc-stance-cancel')?.addEventListener('click', () => {
    document.getElementById('tc-position').style.display = 'none';
  });
  document.getElementById('tc-stance-save')?.addEventListener('click', async () => {
    const stance = document.getElementById('tc-stance-in').value.trim();
    if (!stance) return;
    await saveThreadFm(fm => {
      const pos = Array.isArray(fm.position) ? fm.position : [];
      pos.push({ date: today(), stance });
      fm.position = pos;
      fm.last_touched = today();
    });
    document.getElementById('tc-stance-in').value = '';
    document.getElementById('tc-position').style.display = 'none';
    window.flash?.('position inscribed — the mind has moved');
    loadThreadCard();
  });

  // the forge: open a new thread
  const scrim = document.getElementById('thread-scrim');
  document.getElementById('tc-new-thread')?.addEventListener('click', () => {
    scrim.classList.add('on');
    setTimeout(() => document.getElementById('ts-question')?.focus(), 60);
  });
  document.getElementById('ts-cancel')?.addEventListener('click', () => scrim.classList.remove('on'));
  scrim?.addEventListener('click', e => { if (e.target === scrim) scrim.classList.remove('on'); });
  document.getElementById('ts-open')?.addEventListener('click', async () => {
    const q = document.getElementById('ts-question').value.trim();
    if (!q) { window.flash?.('a thread needs its question'); return; }
    const gripped = document.getElementById('ts-gripped').value.trim();
    const probe = document.getElementById('ts-probe').value.trim();
    try {
      await window.Bridge.notes.create('Threads', threadSlug(q), {
        type: 'thread', question: q, gripped, next_probe: probe,
        opened: today(), status: 'burning', last_touched: today(),
        position: [], sealed: [], trail: []
      }, '');
      scrim.classList.remove('on');
      document.getElementById('ts-question').value = '';
      document.getElementById('ts-gripped').value = '';
      document.getElementById('ts-probe').value = '';
      window.flash?.('a thread is open · ' + q.slice(0, 60));
      loadThreadCard();
      window.RM_loadThreadsIntoSky?.();
    } catch (e) { console.debug('[thread-open]', e); window.flash?.('the thread would not open'); }
  });

  // see all threads — a browsable home; only one lives on the Threshold at a time
  document.getElementById('tc-see-all')?.addEventListener('click', () => window.RM_openThreadsSheet?.());
}

// ---- The threads, all of them: a browsable index (Threshold shows only one) ----
async function loadThreadsSheet() {
  const list = document.getElementById('threads-list');
  if (!list || !window.Bridge) return;
  list.innerHTML = '<p class="tri-clear">reading the threads…</p>';
  try {
    const files = await window.Bridge.vault.listFiles('Threads').catch(() => []);
    const threads = [];
    for (const f of (files || [])) {
      const rel = 'Threads/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.type !== 'thread') continue;
      threads.push(fm);
    }
    if (!threads.length) {
      list.innerHTML = '<p class="tri-clear">no threads yet — one opens the moment a question grips you.</p>';
      return;
    }
    const order = { burning: 0, fallow: 1, answered: 2, dissolved: 3 };
    threads.sort((a, b) => {
      const oa = order[a.status] != null ? order[a.status] : 9, ob = order[b.status] != null ? order[b.status] : 9;
      if (oa !== ob) return oa - ob;
      return (b.last_touched || '') < (a.last_touched || '') ? -1 : 1;
    });
    list.innerHTML = threads.map((fm) => {
      const badge = { burning: 'burning', fallow: 'fallow', answered: 'answered', dissolved: 'dissolved' }[fm.status] || (fm.status || '');
      const positions = Array.isArray(fm.position) ? fm.position : [];
      const lastPos = positions.length ? positions[positions.length - 1] : null;
      const seals = Array.isArray(fm.sealed) ? fm.sealed : [];
      const lastSeal = seals.length ? seals[seals.length - 1] : null;
      let detail = '';
      if (fm.gripped) detail += '<div class="tr-line"><b>why it grips —</b> ' + escHtml(fm.gripped) + '</div>';
      if (lastPos && lastPos.stance) detail += '<div class="tr-line"><b>where you stand —</b> ' + escHtml(lastPos.stance) + '</div>';
      if (fm.status === 'fallow' && lastSeal) detail += '<div class="tr-line"><b>sealed with —</b> ' + escHtml(lastSeal.stood || lastSeal.believed || '…') + '</div>';
      return '<div class="thread-row"><div class="tr-top"><span class="tr-badge tr-' + escHtml(fm.status || '') + '">' + escHtml(badge) + '</span>' +
        '<span class="tr-q">' + escHtml(fm.question || '(an unnamed question)') + '</span></div>' +
        '<div class="tr-detail" style="display:none">' + (detail || '<div class="tr-line">— nothing more inscribed yet —</div>') + '</div></div>';
    }).join('');
    list.querySelectorAll('.thread-row').forEach((row) => {
      row.addEventListener('click', () => {
        const d = row.querySelector('.tr-detail');
        d.style.display = d.style.display === 'none' ? 'block' : 'none';
      });
    });
  } catch (e) { console.debug('[threads-sheet]', e); list.innerHTML = '<p class="tri-clear">the threads would not open.</p>'; }
}
window.RM_openThreadsSheet = function () {
  const scrim = document.getElementById('threads-scrim');
  if (!scrim) return;
  scrim.classList.add('on');
  loadThreadsSheet();
};
document.getElementById('threads-close')?.addEventListener('click', () =>
  document.getElementById('threads-scrim')?.classList.remove('on'));
document.getElementById('threads-scrim')?.addEventListener('click', (e) => {
  if (e.target.id === 'threads-scrim') e.currentTarget.classList.remove('on');
});

let rsCurrent = null;   // { kind, rel, quote, created } — kind: 'highlight' | 'synthesis'

async function loadResurface() {
  const card = document.getElementById('resurface');
  if (!card || !window.Bridge) return;
  if (!askFreeFor('resurface')) { card.hidden = true; rsCurrent = null; return; }  // one ask per session
  try {
    const today = new Date().toISOString().slice(0, 10);
    let best = null;

    // scan Readings for due highlights
    const readFiles = await window.Bridge.vault.listFiles('Readings').catch(() => []);
    for (const f of (readFiles || [])) {
      const rel  = 'Readings/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      const hls = Array.isArray(fm.highlights) ? fm.highlights : [];
      for (const h of hls) {
        const due = h && h.review && h.review.due;
        if (!due || due > today) continue;
        if (!best || due < best.due) {
          best = { kind: 'highlight', due, rel, title: fm.title || f.name,
                   quote: (h.anchor && h.anchor.quote) || h.quote || '',
                   why: h.why || '', created: h.created || '' };
        }
      }
    }

    // scan Notes for due synthesis notes (slow burn)
    const noteFiles = await window.Bridge.vault.listFiles('Notes').catch(() => []);
    for (const f of (noteFiles || [])) {
      const rel  = 'Notes/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.type !== 'synthesis') continue;
      const due = fm.review && fm.review.due;
      if (!due || due > today) continue;
      if (!best || due < best.due) {
        const connection = fm.connection || (note.body || '').slice(0, 200) || '';
        best = { kind: 'synthesis', due, rel, title: connection.slice(0, 80) || 'a forged connection',
                 quote: connection, why: '', created: fm.created || '' };
      }
    }

    // scan Journal for due weekly shapes and sealed letters (Phase G)
    const jFiles = await window.Bridge.vault.listFiles('Journal').catch(() => []);
    for (const f of (jFiles || [])) {
      if (!/^(weekly-|letter-)/.test(f.name)) continue;
      const rel = 'Journal/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(rel).catch(() => null);
      if (!note) continue;
      const fm = note.frontmatter || {};
      if (fm.type !== 'weekly' && fm.type !== 'letter') continue;
      if (fm.opened) continue;
      const due = fm.review && fm.review.due;
      if (!due || due > today) continue;
      if (!best || due < best.due) {
        if (fm.type === 'weekly') {
          best = { kind: 'weekly', due, rel, title: fm.week || '',
                   quote: fm.commit || '(no commit written)', why: fm.moved || '', created: fm.created || '' };
        } else {
          best = { kind: 'letter', due, rel, title: 'a letter from ' + (fm.created || 'your past self'),
                   quote: (note.body || '').slice(0, 600), why: '', created: fm.created || '' };
        }
      }
    }

    if (!best) { card.hidden = true; rsCurrent = null; return; }

    rsCurrent = { kind: best.kind, rel: best.rel, quote: best.quote, created: best.created };
    const qEl   = document.getElementById('rs-quote');
    const wEl   = document.getElementById('rs-why');
    const sEl   = document.getElementById('rs-src');
    const tagEl = document.getElementById('rs-tag');
    const lblEl = document.getElementById('rs-why-label');
    const hlCtl = document.getElementById('rs-hl-controls');
    const bnCtl = document.getElementById('rs-burn-controls');
    const refEl = document.getElementById('rs-reflection');

    // reset the veil from any previous highlight card
    const veilEl = document.getElementById('rs-veil');
    if (veilEl) veilEl.style.display = 'none';
    if (qEl) qEl.style.display = '';
    if (wEl && wEl.parentElement) wEl.parentElement.style.display = '';
    if (sEl) sEl.style.display = '';

    if (best.kind === 'weekly') {
      if (tagEl) tagEl.textContent = '⸻ ninety days ago, you committed to this — has it held? ⸻';
      if (lblEl) lblEl.textContent = 'what moved in you then';
      if (qEl)   qEl.textContent   = '”' + best.quote + '”';
      if (wEl)   wEl.textContent   = best.why || '(you wrote nothing else that week)';
      if (sEl)   sEl.textContent   = '— the weekly shape · ' + best.title;
      if (hlCtl) hlCtl.style.display = 'none';
      if (bnCtl) bnCtl.style.display = '';
      if (refEl) { refEl.value = ''; refEl.placeholder = 'Did it hold? One honest sentence…'; }
    } else if (best.kind === 'letter') {
      if (tagEl) tagEl.textContent = '⸻ the year has turned — a letter, unsealed ⸻';
      if (lblEl) lblEl.textContent = '';
      if (qEl)   qEl.textContent   = best.quote;
      if (wEl)   { wEl.textContent = ''; if (wEl.parentElement) wEl.parentElement.style.display = 'none'; }
      if (sEl)   sEl.textContent   = '— ' + best.title;
      if (hlCtl) hlCtl.style.display = 'none';
      if (bnCtl) bnCtl.style.display = '';
      if (refEl) { refEl.value = ''; refEl.placeholder = 'Answer the one who wrote it, if you wish…'; }
    } else if (best.kind === 'synthesis') {
      if (tagEl) tagEl.textContent = '⸻ a connection you forged — has it grown? ⸻';
      if (lblEl) lblEl.textContent = 'the bridge you wrote';
      if (qEl)   qEl.textContent   = best.quote ? '”' + best.quote + '”' : '(a connection you made)';
      if (wEl)   wEl.textContent   = '';
      if (sEl)   sEl.textContent   = '— forged ' + (best.created || 'some time ago');
      if (hlCtl) hlCtl.style.display = 'none';
      if (bnCtl) bnCtl.style.display = '';
      if (refEl) refEl.value = '';
    } else {
      if (tagEl) tagEl.textContent = '⸻ you kept a passage — can you recall it? ⸻';
      if (lblEl) lblEl.textContent = 'why you kept it';
      if (qEl)   qEl.textContent   = best.quote ? '”' + best.quote + '”' : '(a passage you kept)';
      if (wEl)   wEl.textContent   = best.why || '(kept without a note)';
      if (sEl)   sEl.textContent   = '— from ' + best.title;
      if (hlCtl) hlCtl.style.display = '';
      if (bnCtl) bnCtl.style.display = 'none';
      // the veil: retrieval before review — the cue is the why + source, the
      // passage stays hidden until the mind has reached for it (testing effect)
      const veil = document.getElementById('rs-veil');
      const cue  = document.getElementById('rs-veil-cue');
      if (veil && qEl && best.quote) {
        cue.textContent = 'You kept it because: ' + (best.why || '(no note)') + ' — from ' + best.title + '.';
        veil.style.display = '';
        qEl.style.display = 'none';
        if (wEl && wEl.parentElement) wEl.parentElement.style.display = 'none';
        if (sEl) sEl.style.display = 'none';
        if (hlCtl) hlCtl.style.display = 'none';
      }
    }
    claimAsk('resurface');
    card.hidden = false;
  } catch (e) { console.debug('[resurface]', e); card.hidden = true; }
}
// lift the veil — reveal the passage after the recall attempt
document.getElementById('rs-reveal')?.addEventListener('click', () => {
  const veil = document.getElementById('rs-veil');
  const qEl  = document.getElementById('rs-quote');
  const wEl  = document.getElementById('rs-why');
  const sEl  = document.getElementById('rs-src');
  const hlCtl = document.getElementById('rs-hl-controls');
  if (veil) veil.style.display = 'none';
  if (qEl)  qEl.style.display = '';
  if (wEl && wEl.parentElement) wEl.parentElement.style.display = '';
  if (sEl)  sEl.style.display = '';
  if (hlCtl) hlCtl.style.display = '';
});
window.loadResurface = loadResurface;

// rewrite the matched highlight's review block, then re-scan for the next due item
async function reviewResurface(action) {
  if (!rsCurrent || !window.Bridge) return;
  const { kind, rel, quote, created } = rsCurrent;
  try {
    if (kind === 'synthesis' || kind === 'weekly' || kind === 'letter') {
      const reflection = (document.getElementById('rs-reflection')?.value || '').trim();
      const note = await window.Bridge.notes.readParsed(rel);
      const fm   = (note && note.frontmatter) || {};
      const today = new Date().toISOString().slice(0, 10);
      if (action === 'save' && reflection) {
        const refs = Array.isArray(fm.reflections) ? fm.reflections : [];
        refs.push({ date: today, text: reflection });
        fm.reflections = refs;
        window.flash?.(kind === 'letter' ? 'answered, across the year' : 'reflection inscribed');
      } else {
        window.flash?.(kind === 'letter' ? 'read, and kept' : 'returned to the shelf');
      }
      if (kind === 'letter' || kind === 'weekly') {
        // the mirror speaks once; it does not nag. Opened things rest.
        fm.opened = today;
        delete fm.review;
      } else {
        const cur = (fm.review && fm.review.interval) || 1;
        const interval = Math.min(Math.round(cur * 1.5), 90);
        fm.review = { due: addDaysISO(today, interval), interval };
      }
      await window.Bridge.notes.write(rel, fm, (note && note.body) || '');
    } else {
      const note = await window.Bridge.notes.readParsed(rel);
      const fm   = (note && note.frontmatter) || {};
      const hls  = Array.isArray(fm.highlights) ? fm.highlights : [];
      const today = new Date().toISOString().slice(0, 10);
      const h = hls.find(x => {
        const xq = (x.anchor && x.anchor.quote) || x.quote || '';
        return xq === quote && (created ? x.created === created : true);
      });
      if (h) {
        const cur = (h.review && h.review.interval) || 1;
        if (action === 'hold') {
          const interval = Math.max(1, cur * 2);
          h.review = { due: addDaysISO(today, interval), interval };
          window.flash?.('kept · it returns in ' + interval + ' day' + (interval === 1 ? '' : 's'));
        } else {
          h.review = { due: addDaysISO(today, 30), interval: cur };
          window.flash?.('let it rest');
        }
        await window.Bridge.notes.write(rel, fm, (note && note.body) || '');
      }
    }
  } catch (e) { console.debug('[resurface-review]', e); }
  rsCurrent = null;
  releaseAsk();   // an answered ask invites the next
  loadResurface();
}
{
  document.getElementById('rs-hold')?.addEventListener('click', () => reviewResurface('hold'));
  document.getElementById('rs-rest')?.addEventListener('click', () => reviewResurface('rest'));
  document.getElementById('rs-reflect-save')?.addEventListener('click', () => reviewResurface('save'));
  document.getElementById('rs-reflect-skip')?.addEventListener('click', () => reviewResurface('skip'));
}

// ---- The Bridge: discovered connections between new ideas and existing notes ----
let bpCurrent = null;

function loadBridgePrompt() {
  const card = document.getElementById('bridge-prompt');
  if (!card) return;
  if (!askFreeFor('bridge')) { card.hidden = true; bpCurrent = null; return; }  // one ask per session
  const q = JSON.parse(localStorage.getItem('rm-bridge-queue') || '[]');
  if (!q.length) { card.hidden = true; bpCurrent = null; return; }
  bpCurrent = q[0];
  const matchEl = document.getElementById('bp-match');
  const textEl  = document.getElementById('bp-text');
  const inputEl = document.getElementById('bp-input');
  if (matchEl) matchEl.textContent = '"' + (bpCurrent.matchTitle || bpCurrent.source2) + '"';
  if (textEl)  textEl.textContent  = ' ' + (bpCurrent.text || '').slice(0, 120);
  if (inputEl) inputEl.value = '';
  claimAsk('bridge');
  card.hidden = false;
}
window.loadBridgePrompt = loadBridgePrompt;

async function saveBridge() {
  const inputEl = document.getElementById('bp-input');
  const connection = (inputEl?.value || '').trim();
  if (!connection || !bpCurrent) return;
  const item = bpCurrent;
  const q = JSON.parse(localStorage.getItem('rm-bridge-queue') || '[]');
  q.shift();
  localStorage.setItem('rm-bridge-queue', JSON.stringify(q));
  bpCurrent = null;
  const today = new Date().toISOString().slice(0, 10);
  const fm = {
    type: 'synthesis', subtype: 'bridge',
    created: today,
    sources: [item.source1 || '', item.source2 || ''],
    connection,
    why: connection,
    review: { due: addDaysISO(today, 1), interval: 1 },
  };
  try {
    await window.Bridge.notes.create('Notes', 'bridge-' + Date.now(), fm, '');
    window.flash?.('bridge inscribed · it will return');
  } catch(e) { console.debug('[bridge-save]', e); }
  releaseAsk();   // an answered ask invites the next
  loadBridgePrompt();
}

function skipBridge() {
  const q = JSON.parse(localStorage.getItem('rm-bridge-queue') || '[]');
  q.shift();
  localStorage.setItem('rm-bridge-queue', JSON.stringify(q));
  bpCurrent = null;
  releaseAsk();
  loadBridgePrompt();
}

{
  document.getElementById('bp-save')?.addEventListener('click', saveBridge);
  document.getElementById('bp-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBridge(); } });
  document.getElementById('bp-skip')?.addEventListener('click', skipBridge);
}

// ===== B1: The Training Table — a real gym/body feature (Herakles' labors) =====
// All state lives in plain Markdown the owner owns: Body/exercises.md (the library),
// Body/split.md (the weekday plan), Body/<date>.md (one workout per day). Config
// files are only written on a real edit — never auto-created on load.
{
  const DAYS = [['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun']];
  const DEFAULTS = {
    exercises: [
      { name:'Back Squat',     group:'legs', unit:'kg' },
      { name:'Bench Press',    group:'push', unit:'kg' },
      { name:'Deadlift',       group:'pull', unit:'kg' },
      { name:'Overhead Press', group:'push', unit:'kg' },
    ],
    metrics: [ { name:'Bodyweight', unit:'kg' }, { name:'Body fat', unit:'%' } ],
    week:    { mon:'Push', tue:'Pull', wed:'Legs', thu:'Rest', fri:'Push', sat:'Pull', sun:'Rest' },
    sessions:{ Push:['Bench Press','Overhead Press'], Pull:['Deadlift'], Legs:['Back Squat'] },
  };
  const G = { exercises:[], metrics:[], week:{}, sessions:{}, workouts:[], editingDay:null, logSession:null, loaded:false };

  const clone     = (o) => JSON.parse(JSON.stringify(o));
  const todayISO  = () => new Date().toISOString().slice(0, 10);
  const todayDow  = () => DAYS[(new Date().getDay() + 6) % 7][0];   // JS Sun=0 → Mon-first
  const isRest    = (s) => /^rest$/i.test(String(s || ''));
  const val       = (sel) => { const el = document.querySelector(sel); return el ? el.value.trim() : ''; };
  const epley     = (kg, reps) => kg * (1 + reps / 30);
  const metricValueFrom = (w, name) =>
    /body\s*weight/i.test(name) ? w.bodyweight
    : /body\s*fat/i.test(name)  ? w.bodyfat
    : (w.metrics && w.metrics[name]);

  async function loadGym() {
    if (!window.Bridge) return;
    let ex = null, sp = null;
    try { const n = await window.Bridge.notes.readParsed('Body/exercises.md'); ex = n && n.frontmatter; } catch (e) {}
    try { const n = await window.Bridge.notes.readParsed('Body/split.md');     sp = n && n.frontmatter; } catch (e) {}
    G.exercises = (ex && Array.isArray(ex.exercises) && ex.exercises.length) ? ex.exercises : clone(DEFAULTS.exercises);
    G.metrics   = (ex && Array.isArray(ex.metrics)   && ex.metrics.length)   ? ex.metrics   : clone(DEFAULTS.metrics);
    G.week      = (sp && sp.week     && typeof sp.week     === 'object') ? Object.assign(clone(DEFAULTS.week), sp.week) : clone(DEFAULTS.week);
    G.sessions  = (sp && sp.sessions && typeof sp.sessions === 'object') ? sp.sessions : clone(DEFAULTS.sessions);

    G.workouts = [];
    try {
      const files = await window.Bridge.vault.listFiles('Body');
      if (Array.isArray(files)) {
        for (const f of files) {
          if (f.name === 'exercises' || f.name === 'split') continue;
          const n  = await window.Bridge.notes.readParsed('Body/' + f.name + '.md').catch(() => null);
          const fm = n && n.frontmatter;
          if (fm && fm.type === 'workout') G.workouts.push(fm);
        }
      }
    } catch (e) {}
    G.workouts.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    G.loaded = true;
    renderWeek(); renderLog(); renderLib(); renderProg();
  }

  async function saveExercises() {
    try { await window.Bridge.notes.write('Body/exercises.md', { type:'exercise-library', exercises:G.exercises, metrics:G.metrics }, ''); }
    catch (e) { console.debug('[gym ex]', e); window.flash?.('could not save the library'); }
  }
  async function saveSplit() {
    try { await window.Bridge.notes.write('Body/split.md', { type:'split', week:G.week, sessions:G.sessions }, ''); }
    catch (e) { console.debug('[gym split]', e); window.flash?.('could not save the split'); }
  }

  /* ---- Part 1 · the week's split ---- */
  function renderWeek() {
    const wk = document.getElementById('tt-week'); if (!wk) return;
    const td = todayDow();
    wk.innerHTML = DAYS.map(([k, lab]) => {
      const sess = G.week[k] || 'Rest';
      const cls = ['tt-day'];
      if (k === td) cls.push('today');
      if (isRest(sess)) cls.push('rest');
      if (G.editingDay === k) cls.push('sel');
      return `<div class="${cls.join(' ')}" data-day="${k}"><div class="dn">${lab}</div><div class="ds">${escHtml(sess)}</div></div>`;
    }).join('');
    renderDayEditor();
  }
  function renderDayEditor() {
    const box = document.getElementById('tt-day-editor'); if (!box) return;
    const k = G.editingDay;
    if (!k) { box.innerHTML = ''; return; }
    const lab  = (DAYS.find(d => d[0] === k) || [])[1] || k;
    const sess = G.week[k] || 'Rest';
    const inSession = new Set(G.sessions[sess] || []);
    const checks = G.exercises.map(e =>
      `<button type="button" class="tt-check" data-ex="${escHtml(e.name)}" aria-pressed="${inSession.has(e.name) ? 'true' : 'false'}">${escHtml(e.name)}</button>`
    ).join('');
    box.innerHTML = `<div class="tt-editor">
      <div class="lbl">${escHtml(lab)} — the session</div>
      <div class="tt-add"><input class="nmin" id="tt-sess-name" value="${escHtml(sess)}" placeholder="Push · Pull · Legs · Rest" autocomplete="off"></div>
      <div class="lbl" style="margin-top:14px">which exercises this session holds</div>
      <div class="tt-checks">${checks || '<span class="tt-empty">add exercises in the library first.</span>'}</div>
      <div class="tt-add" style="justify-content:flex-end">
        <button class="btn ghost" data-tt="day-cancel">cancel</button>
        <button class="btn" data-tt="day-save">set this day</button>
      </div>
    </div>`;
  }
  function saveDay() {
    const k = G.editingDay; if (!k) return;
    const box = document.getElementById('tt-day-editor');
    const name = (box.querySelector('#tt-sess-name')?.value || '').trim() || 'Rest';
    G.week[k] = name;
    if (!isRest(name)) {
      G.sessions[name] = [...box.querySelectorAll('.tt-check[aria-pressed="true"]')].map(c => c.dataset.ex);
    }
    G.editingDay = null;
    saveSplit(); renderWeek(); renderLog();
    window.flash?.('set · ' + name);
  }

  /* ---- Part 2 · log today ---- */
  function currentLogSession() {
    if (G.logSession != null) return G.logSession;
    return G.week[todayDow()] || Object.keys(G.sessions)[0] || 'Rest';
  }
  function setRowHtml(s, unit) {
    const kg   = (s && s.kg   != null && s.kg   !== '') ? escHtml(s.kg)   : '';
    const reps = (s && s.reps != null && s.reps !== '') ? escHtml(s.reps) : '';
    return `<div class="tt-set"><input class="tt-in kg" inputmode="decimal" placeholder="${escHtml(unit || 'kg')}" value="${kg}"><span class="mul">×</span><input class="tt-in reps" inputmode="numeric" placeholder="reps" value="${reps}"></div>`;
  }
  function renderLog() {
    const box = document.getElementById('tt-log-body'); if (!box) return;
    const names    = Object.keys(G.sessions);
    const sess     = currentLogSession();
    const existing = G.workouts.find(w => w.date === todayISO());
    const opts = names.map(n => `<option value="${escHtml(n)}"${n === sess ? ' selected' : ''}>${escHtml(n)}</option>`).join('')
               + `<option value="Rest"${isRest(sess) ? ' selected' : ''}>Rest</option>`;
    const exNames = isRest(sess) ? [] : (G.sessions[sess] || []);
    const liftRows = exNames.map(nm => {
      const ex = G.exercises.find(e => e.name === nm) || { unit:'kg' };
      let sets = [{ kg:'', reps:'' }];
      if (existing) { const lf = (existing.lifts || []).find(l => l.name === nm); if (lf && lf.sets && lf.sets.length) sets = lf.sets; }
      const setHtml = sets.map(s => setRowHtml(s, ex.unit)).join('');
      return `<div class="tt-logrow" data-ex="${escHtml(nm)}" data-unit="${escHtml(ex.unit || 'kg')}">
        <div><div class="ln">${escHtml(nm)}</div><button class="tt-addset" data-tt="addset">+ set</button></div>
        <div class="tt-sets">${setHtml}</div>
      </div>`;
    }).join('');
    const metricHtml = G.metrics.map(m => {
      let v = existing ? metricValueFrom(existing, m.name) : '';
      v = (v == null) ? '' : v;
      return `<div class="tt-metric"><label>${escHtml(m.name)}</label><input class="tt-in metric" data-metric="${escHtml(m.name)}" inputmode="decimal" placeholder="${escHtml(m.unit || '')}" value="${v !== '' ? escHtml(v) : ''}"></div>`;
    }).join('');
    box.innerHTML = `
      <div class="tt-sessel">
        <span style="font-family:var(--sc);font-size:11.5px;letter-spacing:.12em;color:var(--gold-deep)">session</span>
        <select id="tt-log-sess">${opts}</select>
        ${existing ? '<span class="gp" style="color:var(--verm)">· re-logging today</span>' : ''}
      </div>
      ${exNames.length ? `<div id="tt-lifts">${liftRows}</div>` : '<div class="tt-empty">A rest day — or this session holds no exercises yet.</div>'}
      <div class="tt-metrics">${metricHtml}</div>
      <div class="tt-add" style="justify-content:flex-end"><button class="btn" data-tt="log-save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M5 13l4 4 10-11"/></svg> set it down</button></div>`;
  }
  async function saveWorkout() {
    const box  = document.getElementById('tt-log-body'); if (!box) return;
    const sess = box.querySelector('#tt-log-sess')?.value || 'Rest';
    const lifts = [];
    box.querySelectorAll('.tt-logrow').forEach(row => {
      const name = row.dataset.ex, sets = [];
      row.querySelectorAll('.tt-set').forEach(sr => {
        const kg = parseFloat(sr.querySelector('.kg').value);
        const reps = parseInt(sr.querySelector('.reps').value, 10);
        if (!isNaN(kg) && !isNaN(reps)) sets.push({ kg, reps });
      });
      if (sets.length) lifts.push({ name, sets });
    });
    const fm = { type:'workout', date:todayISO(), session:sess, lifts };
    box.querySelectorAll('.metric').forEach(mi => {
      const v = parseFloat(mi.value); if (isNaN(v)) return;
      const nm = mi.dataset.metric;
      if (/body\s*weight/i.test(nm)) fm.bodyweight = v;
      else if (/body\s*fat/i.test(nm)) fm.bodyfat = v;
      else { fm.metrics = fm.metrics || {}; fm.metrics[nm] = v; }
    });
    if (!lifts.length && fm.bodyweight == null && fm.bodyfat == null && !fm.metrics) {
      window.flash?.('nothing to set down yet'); return;
    }
    try {
      await window.Bridge.notes.write('Body/' + todayISO() + '.md', fm, '');
      G.workouts = G.workouts.filter(w => w.date !== todayISO());
      G.workouts.push(fm);
      G.workouts.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      renderProg();
      window.flash?.('set down · ' + sess);
    } catch (e) { console.debug('[gym log]', e); window.flash?.('could not set it down'); }
  }

  /* ---- Part 3 · the exercise library ---- */
  function renderLib() {
    const box = document.getElementById('tt-lib-body'); if (!box) return;
    const exRows = G.exercises.map(e =>
      `<div class="tt-row"><span class="nm">${escHtml(e.name)}</span><span class="gp">${escHtml(e.group || '')}${e.group ? ' · ' : ''}${escHtml(e.unit || 'kg')}</span><button class="tt-x" data-tt="del-ex" data-name="${escHtml(e.name)}" title="remove">×</button></div>`
    ).join('') || '<div class="tt-empty">No exercises yet.</div>';
    const mRows = G.metrics.map(m =>
      `<div class="tt-row"><span class="nm">${escHtml(m.name)}</span><span class="gp">${escHtml(m.unit || '')}</span><button class="tt-x" data-tt="del-metric" data-name="${escHtml(m.name)}" title="remove">×</button></div>`
    ).join('') || '<div class="tt-empty">No metrics yet.</div>';
    box.innerHTML = `
      ${exRows}
      <div class="tt-add">
        <input class="nmin" id="tt-ex-name" placeholder="new exercise — e.g. Romanian Deadlift" autocomplete="off">
        <input class="gpin" id="tt-ex-group" placeholder="group" autocomplete="off">
        <input class="gpin" id="tt-ex-unit" placeholder="kg" value="kg" autocomplete="off">
        <button class="btn ghost" data-tt="add-ex">add</button>
      </div>
      <div class="tt-h" style="margin:18px 0 6px">body metrics</div>
      ${mRows}
      <div class="tt-add">
        <input class="nmin" id="tt-m-name" placeholder="new metric — e.g. Waist" autocomplete="off">
        <input class="gpin" id="tt-m-unit" placeholder="cm" autocomplete="off">
        <button class="btn ghost" data-tt="add-metric">add</button>
      </div>`;
  }
  function addExercise() {
    const nm = val('#tt-ex-name'), gp = val('#tt-ex-group'), unit = val('#tt-ex-unit') || 'kg';
    if (!nm) { window.flash?.('name the exercise'); return; }
    if (G.exercises.some(e => e.name.toLowerCase() === nm.toLowerCase())) { window.flash?.('already in the library'); return; }
    G.exercises.push({ name:nm, group:gp || '', unit });
    saveExercises(); renderLib(); renderLog(); renderDayEditor();
    window.flash?.('added · ' + nm);
  }
  function delExercise(name) {
    G.exercises = G.exercises.filter(e => e.name !== name);
    let changed = false;
    Object.keys(G.sessions).forEach(s => {
      const before = G.sessions[s].length;
      G.sessions[s] = G.sessions[s].filter(n => n !== name);
      if (G.sessions[s].length !== before) changed = true;
    });
    saveExercises(); if (changed) saveSplit();
    renderLib(); renderLog(); renderProg(); renderWeek();
    window.flash?.('removed · ' + name);
  }
  function addMetric() {
    const nm = val('#tt-m-name'), unit = val('#tt-m-unit');
    if (!nm) { window.flash?.('name the metric'); return; }
    if (G.metrics.some(m => m.name.toLowerCase() === nm.toLowerCase())) { window.flash?.('already tracked'); return; }
    G.metrics.push({ name:nm, unit:unit || '' });
    saveExercises(); renderLib(); renderLog();
    window.flash?.('added · ' + nm);
  }
  function delMetric(name) {
    G.metrics = G.metrics.filter(m => m.name !== name);
    saveExercises(); renderLib(); renderLog(); renderProg();
    window.flash?.('removed · ' + name);
  }

  /* ---- Part 4 · progression ---- */
  function sparkline(vals, color) {
    if (!vals.length) return '';
    if (vals.length === 1) return `<polyline fill="none" stroke="${color}" stroke-width="2" points="0,44 280,44"/>`;
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * 280;
      const y = 78 - ((v - min) / range) * 68;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return `<polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.join(' ')}"/>`;
  }
  function exerciseSeries(name) {
    const pts = [];
    G.workouts.forEach(w => {
      const lf = (w.lifts || []).find(l => l.name === name);
      if (!lf || !lf.sets || !lf.sets.length) return;
      let best = 0, top = 0;
      lf.sets.forEach(s => {
        const kg = +s.kg, reps = +s.reps;
        if (isNaN(kg) || isNaN(reps)) return;
        const e = epley(kg, reps);
        if (e > best) best = e;
        if (kg > top) top = kg;
      });
      if (best > 0) pts.push({ date:w.date, val:best, top });
    });
    return pts;
  }
  function metricSeries(name) {
    const pts = [];
    G.workouts.forEach(w => {
      const v = parseFloat(metricValueFrom(w, name));
      if (!isNaN(v)) pts.push({ date:w.date, val:v });
    });
    return pts;
  }
  function renderProg() {
    const box = document.getElementById('tt-prog-body'); if (!box) return;
    const cards = [];
    G.exercises.forEach(e => {
      const pts = exerciseSeries(e.name); if (!pts.length) return;
      const latest = pts[pts.length - 1];
      cards.push(`<div class="chartcard">
        <h4>${escHtml(e.name.toLowerCase())} · ${escHtml(e.unit || 'kg')}</h4>
        <div class="now">${Math.round(latest.top)} ${escHtml(e.unit || 'kg')} <span style="font-family:var(--sc);font-size:12px;letter-spacing:.08em;color:var(--gold-deep)">top set · ~${Math.round(latest.val)} 1RM</span></div>
        <svg viewBox="0 0 280 90" preserveAspectRatio="none">${sparkline(pts.map(p => p.val), 'var(--verm)')}</svg>
      </div>`);
    });
    G.metrics.forEach(m => {
      const pts = metricSeries(m.name); if (!pts.length) return;
      const latest = pts[pts.length - 1];
      cards.push(`<div class="chartcard">
        <h4>${escHtml(m.name.toLowerCase())} · ${escHtml(m.unit || '')}</h4>
        <div class="now">${latest.val} ${escHtml(m.unit || '')}</div>
        <svg viewBox="0 0 280 90" preserveAspectRatio="none">${sparkline(pts.map(p => p.val), 'var(--ink-2)')}</svg>
      </div>`);
    });
    box.innerHTML = cards.length ? cards.join('') : '<div class="tt-empty">Log a session and your progression will be engraved here, week upon week.</div>';
  }

  /* ---- wiring (event delegation over the whole table) ---- */
  const root = document.getElementById('training-table');
  if (root) {
    root.addEventListener('click', (e) => {
      const day = e.target.closest('.tt-day');
      if (day) { const k = day.dataset.day; G.editingDay = (G.editingDay === k) ? null : k; renderWeek(); return; }
      const chk = e.target.closest('.tt-check');
      if (chk) { chk.setAttribute('aria-pressed', chk.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }
      const b = e.target.closest('[data-tt]'); if (!b) return;
      const act = b.dataset.tt;
      if (act === 'day-cancel')      { G.editingDay = null; renderWeek(); }
      else if (act === 'day-save')   saveDay();
      else if (act === 'addset')     { const row = b.closest('.tt-logrow'); row.querySelector('.tt-sets').insertAdjacentHTML('beforeend', setRowHtml({}, row.dataset.unit)); }
      else if (act === 'log-save')   saveWorkout();
      else if (act === 'add-ex')     addExercise();
      else if (act === 'del-ex')     delExercise(b.dataset.name);
      else if (act === 'add-metric') addMetric();
      else if (act === 'del-metric') delMetric(b.dataset.name);
    });
    root.addEventListener('change', (e) => {
      if (e.target.id === 'tt-log-sess') { G.logSession = e.target.value; renderLog(); }
    });
  }
  window.RM_loadGym = loadGym;
}

// ---- Global search — real FTS over vault ----
{
  const input   = document.getElementById('globalsearch');
  const panel   = document.getElementById('search-results');
  if (input && panel) {
    let timer;
    const close = () => { panel.classList.remove('on'); };

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (!q) { close(); return; }
      timer = setTimeout(async () => {
        if (!window.Bridge) return;
        try {
          const norm = (p) => String(p || '').replace(/\\/g, '/');   // Windows paths → forward slashes
          const kindFor = (p) => p.startsWith('Readings/') ? 'reading'
                              : p.startsWith('Goals/')    ? 'goal'
                              : p.startsWith('Bucket/')   ? 'wish'
                              : p.startsWith('Notes/')    ? 'note'
                              : p.startsWith('Journal/')  ? 'capture' : '';
          // FTS (exact words) + semantic (by meaning) in parallel; semantic degrades to []
          const [fts, sem] = await Promise.all([
            window.Bridge.search.fts(q, 8).catch(() => []),
            window.Bridge.search.semantic(q, 8).catch(() => []),
          ]);

          const seen = new Set();
          const rows = [];
          (fts || []).forEach(r => {
            const p = norm(r.path);
            if (seen.has(p)) return; seen.add(p);
            rows.push({ path: p, title: r.title, excerpt: r.excerpt, kind: kindFor(p), sem: false });
          });
          let firstSem = -1;
          (sem || []).forEach(r => {
            const p = norm(r.path);
            if (seen.has(p)) return; seen.add(p);
            if (firstSem < 0) firstSem = rows.length;
            rows.push({ path: p, title: r.title, excerpt: r.excerpt, kind: kindFor(p), sem: true });
          });

          if (!rows.length) {
            panel.innerHTML = '<div class="sr-none">Nothing surfaced — try a different turn of phrase.</div>';
          } else {
            panel.innerHTML = rows.map((r, i) => {
              const div = (i === firstSem) ? '<div class="sr-div">by meaning</div>' : '';
              return div + `<div class="sr-item" data-path="${escHtml(r.path)}" data-kind="${r.kind}">
                <span class="sr-kind">${r.kind}</span>
                <div class="sr-title">${escHtml(r.title)}</div>
                <div class="sr-exc">${escHtml(r.excerpt)}</div>
              </div>`;
            }).join('');
            panel.querySelectorAll('.sr-item').forEach(el => {
              el.addEventListener('click', () => {
                const path = el.dataset.path;
                close(); input.value = '';
                if (path.startsWith('Readings/') && window.go) {
                  window.go('reading');
                  window.Bridge.notes.readParsed(path).then(note => {
                    if (note) openReadingCard(path, note.frontmatter || {});
                  }).catch(() => {});
                } else if (path.startsWith('Goals/') && window.go) {
                  window.go('atlas');
                } else if (path.startsWith('Bucket/') && window.go) {
                  window.go('cabinet');
                }
              });
            });
          }
          panel.classList.add('on');
        } catch(e) { console.debug('[search]', e); }
      }, 320);
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.search-mini')) close();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { close(); input.value = ''; }
    });
  }
}

// ---- Loop 5: Re-entry — open the EXACT thing where it was left (the First Law) ----
// pick_one_thing returns an ABSOLUTE path; openReadingCard wants a vault-relative
// one. Normalise, then re-open: a reading lands at its saved position (openReading
// restores percent + logs the 'resume' session); a goal flies to its star.
function toVaultRel(abs) {
  if (!abs) return '';
  const p = String(abs).replace(/\\/g, '/');
  const m = p.match(/(?:^|\/)((?:Readings|Goals|Notes|Bucket|Body|Journal)\/[^?#]*)$/);
  return m ? m[1] : p;
}
{
  const btn = document.getElementById('resume-reenter');
  if (btn) {
    btn.addEventListener('click', async () => {
      const rel  = toVaultRel(btn.dataset.readingPath);
      const kind = btn.dataset.kind || '';
      if (!rel || !window.Bridge) return;

      if (kind === 'goal' || rel.startsWith('Goals/')) {
        if (window.go) window.go('atlas');
        if (window.RM_selectGoalByPath) window.RM_selectGoalByPath(rel);
        return;
      }

      // a reading (default): open it on the desk at its saved position
      if (window.go) window.go('reading');
      try {
        const note = await window.Bridge.notes.readParsed(rel);
        await openReadingCard(rel, (note && note.frontmatter) || {});
      } catch (e) {
        console.debug('[re-entry]', e);
        // last-resort: at least log the return so the metric isn't lost
        try { await window.Bridge.stats.logSession('resume', rel, 0); } catch (_) {}
      }
    });
  }
}

// ---- Helpers ----
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Reading Room: the research shelf + the open-books desk ----
// A "shelf" of book-spines (one per reading). Click a spine → the book opens
// on the desk; several can be open at once and you wiggle between them via the
// ribbon tabs. PDFs render lazily; text-only readings show their marginalia.

const openBooks = new Map();        // relPath -> { fm, leaf, tab, rendered }
let activeReadingPath = null;       // kept for the highlight-save handler below

// Varied library bindings — picked deterministically by title so a book keeps
// its colour across reloads. base = face, dark = the shaded edges.
const LEATHERS = [
  { base:'#5c2018', dark:'#3a130d' },  // oxblood
  { base:'#1f3a2b', dark:'#10231a' },  // forest morocco
  { base:'#26354f', dark:'#141d2e' },  // indigo calf
  { base:'#5a4420', dark:'#352713' },  // tan
  { base:'#4a2540', dark:'#2a1325' },  // aubergine
  { base:'#603512', dark:'#3a1f0a' },  // chestnut
  { base:'#3d4a52', dark:'#222a30' },  // slate
  { base:'#6a2530', dark:'#41131b' },  // burgundy
];
function leatherFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return LEATHERS[h % LEATHERS.length];
}

function pdfNameFromFm(fm) {
  if (fm.attachment) return fm.attachment;
  if (typeof fm.source === 'string' && /\.pdf$/i.test(fm.source)) {
    return fm.source.replace(/^Attachments\//i, '');
  }
  return null;
}

function makeSpine(relPath, fm) {
  const title  = fm.title || relPath.split('/').pop().replace(/\.md$/, '');
  const author = fm.author || '';
  const warmth = fm.temp   || 'cold';
  const pct    = (fm.position && fm.position.percent) || 0;
  const lc     = leatherFor(title);

  const el = document.createElement('button');
  el.className = 'spine-book';
  el.dataset.path = relPath;
  el.style.setProperty('--leather',  lc.base);
  el.style.setProperty('--leather2', lc.dark);
  el.style.height = (132 + (title.length % 5) * 7) + 'px';
  el.title = title + (author ? ' · ' + author : '');
  el.setAttribute('aria-label', 'Open ' + title);
  el.innerHTML =
    '<span class="band top"></span>' +
    '<span class="sb-title">' + escHtml(title) + '</span>' +
    '<span class="band bot"></span>' +
    '<span class="sb-pip ' + warmth + '"></span>' +
    (pct > 0 ? '<span class="sb-prog" style="width:' + Math.max(6, Math.min(94, pct)) + '%"></span>' : '');
  el.addEventListener('click', () => openReadingCard(relPath, fm));
  return el;
}

async function loadReadingsList() {
  const grid = document.getElementById('shelf-books');
  const sel  = document.getElementById('reading-sel');
  if (!grid) return;
  if (sel) sel.classList.add('on');

  let files = [];
  try { files = await window.Bridge.vault.listFiles('Readings') || []; }
  catch (e) { console.debug('[reading-list]', e); }

  grid.innerHTML = '';
  if (!files.length) {
    grid.innerHTML = '<p class="empty-note">The shelf is bare — import a PDF to place the first book.</p>';
    return;
  }

  for (const f of files) {
    try {
      const relPath = 'Readings/' + f.name + '.md';
      const note = await window.Bridge.notes.readParsed(relPath);
      const fm   = (note && note.frontmatter) ? note.frontmatter : {};
      if (fm.status === 'bound') continue;             // shelved/finished — hide
      const spine = makeSpine(relPath, fm);
      if (openBooks.has(relPath)) spine.classList.add('open');
      grid.appendChild(spine);
    } catch (e) { /* skip malformed notes */ }
  }
}

// ---- a minimal Markdown render for text-only readings (no PDF) ----
function mdLite(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let html = '', para = [], quote = [];
  const flushP = () => { if (para.length) { html += '<p>' + para.join(' ') + '</p>'; para = []; } };
  const flushQ = () => { if (quote.length) { html += '<blockquote>' + quote.join(' ') + '</blockquote>'; quote = []; } };
  const inline = (s) => escHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
      // target/alias are already HTML-escaped here — this runs after escHtml(s) above
      const label = (alias || target).trim();
      const tEsc = target.trim();
      const tRaw = tEsc.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const hit = window.RM_wikiResolve && window.RM_wikiResolve(tRaw);
      return hit
        ? `<a href="#" class="wikilink" data-note-rel="${escHtml(hit.rel)}">${label}</a>`
        : `<a href="#" class="wikilink unmade" data-note-title="${tEsc}">${label}</a>`;
    });
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushP(); flushQ(); continue; }
    if (/^#{1,6}\s/.test(line)) { flushP(); flushQ(); html += '<h3>' + inline(line.replace(/^#{1,6}\s/, '')) + '</h3>'; continue; }
    if (/^>\s?/.test(line))     { flushP(); quote.push(inline(line.replace(/^>\s?/, ''))); continue; }
    flushQ(); para.push(inline(line));
  }
  flushP(); flushQ();
  return html || '<p class="empty-note">This reading has no body yet.</p>';
}

function updateReaderMeta(fm) {
  const meta = document.getElementById('reader-meta');
  const pct  = (fm.position && fm.position.percent) || 0;
  if (meta) {
    const bits = [fm.title || '', fm.author || ''].filter(Boolean).map(escHtml).join(' · ');
    meta.innerHTML = (bits || 'reading') + ' · <span id="readpct">' + pct + '%</span>';
  }
  const ribbon = document.getElementById('ribbonmark');
  if (ribbon) ribbon.style.height = Math.max(4, pct) + '%';
}

function makeTab(relPath, fm) {
  const tab = document.createElement('div');
  tab.className = 'obtab';
  tab.dataset.path = relPath;
  tab.innerHTML = '<span class="ob-t">' + escHtml(fm.title || relPath.split('/').pop()) + '</span>' +
                  '<button class="ob-x" title="close" aria-label="close">×</button>';
  tab.addEventListener('click', (e) => {
    if (e.target.classList.contains('ob-x')) { e.stopPropagation(); closeBook(relPath); }
    else activateBook(relPath);
  });
  return tab;
}

function activateBook(relPath) {
  const entry = openBooks.get(relPath);
  if (!entry) return;
  activeReadingPath = relPath;
  openBooks.forEach((b, p) => {
    b.leaf.classList.toggle('active', p === relPath);
    b.tab.classList.toggle('active', p === relPath);
  });
  document.querySelectorAll('#shelf-books .spine-book').forEach((s) =>
    s.classList.toggle('open', s.dataset.path === relPath));
  updateReaderMeta(entry.fm);
  updateZoomLabel();
}

// Reflect the active book's zoom on the toolbar (PDFs use the render controller;
// text readings scale their font).
function updateZoomLabel() {
  const entry = openBooks.get(activeReadingPath);
  const el = document.getElementById('zoom-val');
  if (!el) return;
  let z = 1;
  if (entry) z = entry.pdfCtl ? entry.pdfCtl.getZoom() : entry.textZoom;
  el.textContent = Math.round(z * 100) + '%';
}

// ---- the reading light: raw page → candlelit vellum → night ink ----
// One lamp for the whole desk, remembered across sessions. A white A4 page in
// a midnight library is the one surface that breaks the room; this fixes it.
{
  const stack = document.getElementById('reader-stack');
  const btn = document.getElementById('reader-light');
  const lbl = document.getElementById('light-label');
  const MODES = ['page', 'candle', 'night'];
  const NAMES = { page: 'page', candle: 'candle', night: 'night ink' };
  let lightMode = 'page';
  try { const s = localStorage.getItem('rm-readlight'); if (MODES.indexOf(s) >= 0) lightMode = s; } catch (e) {}
  function applyLight() {
    if (!stack) return;
    if (lightMode === 'page') stack.removeAttribute('data-light');
    else stack.dataset.light = lightMode;
    if (lbl) lbl.textContent = NAMES[lightMode];
  }
  if (btn) btn.addEventListener('click', () => {
    lightMode = MODES[(MODES.indexOf(lightMode) + 1) % MODES.length];
    try { localStorage.setItem('rm-readlight', lightMode); } catch (e) {}
    applyLight();
    window.flash && window.flash('reading light · ' + NAMES[lightMode]);
  });
  applyLight();
}

// Re-entry made visible: when a book opens at a kept position, say so — and
// show the owner's last kept "why", the way a friend would remind you.
function showReentry(pct, fm) {
  const wrap = document.getElementById('reader-wrap');
  if (!wrap || pct <= 0) return;
  wrap.querySelectorAll('.reentry-flash').forEach((n) => n.remove());
  const hs = Array.isArray(fm && fm.highlights) ? fm.highlights : [];
  const lastWhy = hs.length ? String(hs[hs.length - 1].why || '').trim() : '';
  const el = document.createElement('div');
  el.className = 'reentry-flash';
  el.innerHTML = '<b>returned to your place · ' + pct + '%</b>' +
    (lastWhy ? '<span>where you kept — “' + escHtml(lastWhy) + '”</span>' : '');
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 600); }, 4200);
}

// Apply a zoom delta to whichever book is on top (0 = reset to 100%).
function zoomActive(delta) {
  const entry = openBooks.get(activeReadingPath);
  if (!entry) return;
  if (entry.pdfCtl) {
    if (delta === 0) entry.pdfCtl.resetZoom();
    else if (delta > 0) entry.pdfCtl.zoomIn();
    else entry.pdfCtl.zoomOut();
  } else {
    // text reading — scale the body type
    entry.textZoom = delta === 0 ? 1
      : Math.min(2.4, Math.max(0.7, Math.round((entry.textZoom + (delta > 0 ? 0.15 : -0.15)) * 100) / 100));
    entry.leaf.style.fontSize = entry.textZoom === 1 ? '' : (entry.textZoom * 100) + '%';
  }
  updateZoomLabel();
}

function closeBook(relPath) {
  const entry = openBooks.get(relPath);
  if (!entry) return;
  entry.leaf.remove();
  entry.tab.remove();
  openBooks.delete(relPath);
  const spine = document.querySelector('#shelf-books .spine-book[data-path="' + (window.CSS && CSS.escape ? CSS.escape(relPath) : relPath) + '"]');
  if (spine) spine.classList.remove('open');

  if (activeReadingPath === relPath) {
    const next = openBooks.keys().next();
    if (!next.done) {
      activateBook(next.value);
    } else {
      activeReadingPath = null;
      const wrap = document.getElementById('reader-wrap');
      wrap.classList.remove('reading-on');
      exitFullscreen();
      document.getElementById('openbar').hidden = true;
      document.getElementById('reader-tools').hidden = true;
      const meta = document.getElementById('reader-meta');
      if (meta) meta.innerHTML = 'the shelf · choose a book to begin · <span id="readpct">0%</span>';
      const ribbon = document.getElementById('ribbonmark');
      if (ribbon) ribbon.style.height = '4%';
    }
  }
}

async function openReadingCard(relPath, fm) {
  document.getElementById('reader-wrap').classList.add('reading-on');
  document.getElementById('openbar').hidden = false;
  document.getElementById('reader-tools').hidden = false;

  // Already on the desk → just bring it forward.
  if (openBooks.has(relPath)) { activateBook(relPath); return; }

  const stack = document.getElementById('reader-stack');
  const leaf  = document.createElement('div');
  leaf.className = 'book-leaf';
  stack.appendChild(leaf);

  const tab = makeTab(relPath, fm);
  document.getElementById('openbar').appendChild(tab);

  const entry = { fm, leaf, tab, rendered: false, pdfCtl: null, textZoom: 1 };
  openBooks.set(relPath, entry);
  activateBook(relPath);

  const pct = (fm.position && fm.position.percent) || 0;
  if (window.Bridge) {
    try { await window.Bridge.stats.logSession(pct > 0 ? 'resume' : 'start', relPath, pct / 100); } catch (e) {}
  }

  const attachment = pdfNameFromFm(fm);
  if (attachment) {
    leaf.classList.add('pdf');
    const attemptPdf = async () => {
      leaf.innerHTML = '<div class="leaf-load">unrolling the leaves…</div>';
      try {
        const { openReading } = await import('../lib/pdfjs-entry.js');
        leaf.innerHTML = '';
        entry.pdfCtl = await openReading(leaf, attachment, relPath, pct / 100);
        entry.rendered = true;
        if (relPath === activeReadingPath) updateZoomLabel();
        if (relPath === activeReadingPath) showReentry(pct, fm);
      } catch (e) {
        console.debug('[pdfjs] open failed', e);
        const msg = e && e.message ? e.message : String(e);
        const missing = /fetch|404|not found|unexpected/i.test(msg);
        leaf.innerHTML =
          '<div class="leaf-fail">' +
            '<div class="lf-glyph">✕</div>' +
            '<h3>This book would not open</h3>' +
            '<p>' + (missing
              ? 'Its pages — <b>' + escHtml(attachment) + '</b> — could not be found on the shelf (the vault’s <i>Attachments/</i> folder). If the file was moved or renamed, return it there, then try again.'
              : 'The file answered, but its pages would not unroll — it may be damaged, or not truly a PDF.') + '</p>' +
            '<div class="lf-acts"><button class="btn ghost" data-retry>try again</button></div>' +
            '<div class="lf-why">' + escHtml(msg) + '</div>' +
          '</div>';
        const rb = leaf.querySelector('[data-retry]');
        if (rb) rb.addEventListener('click', attemptPdf);
      }
    };
    await attemptPdf();
  } else {
    // Text-only reading → render its marginalia/body.
    leaf.classList.add('text');
    try {
      const note = await window.Bridge.notes.readParsed(relPath);
      const title = (note && note.frontmatter && note.frontmatter.title) || fm.title || 'Untitled';
      leaf.innerHTML = '<h2>' + escHtml(title) + '</h2>' +
                       '<div class="rbody">' + mdLite(note && note.body) + '</div>';
      if (relPath === activeReadingPath) showReentry(pct, fm);
    } catch (e) {
      leaf.innerHTML = '<p class="reader-empty" style="display:block">Could not read this note.</p>';
    }
    entry.rendered = true;
  }
}

// ---- Import PDF button ----
{
  const btn = document.getElementById('import-pdf-btn');
  const label = document.getElementById('import-pdf-label');
  const errEl = document.getElementById('import-err');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (!window.Bridge) { window.flash?.('PDF import available in the Tauri app'); return; }
      if (errEl) errEl.hidden = true;
      btn.disabled = true;
      if (label) label.textContent = 'binding the book · unrolling the leaves…';
      try {
        const result = await window.Bridge.pdf.import();
        if (result) {
          window.flash?.('imported · ' + result.title);
          loadReadingsList();
        }
      } catch(e) {
        if (String(e) !== 'No file selected') {
          window.flash?.('import failed');
          if (errEl) { errEl.textContent = 'the last import did not take — try again, or check the file.'; errEl.hidden = false; }
        }
      } finally {
        btn.disabled = false;
        if (label) label.textContent = 'import pdf';
      }
    });
  }
}

window.openReadingCard = openReadingCard;

// ---- Reader instruments: zoom, full screen, remove ----
// Tauri's webview can suppress the native window.confirm; use the dialog plugin
// when present, falling back to window.confirm in a plain browser.
async function confirmRemoval(message) {
  try {
    const d = window.__TAURI__ && window.__TAURI__.dialog;
    if (d && d.ask) {
      return await d.ask(message, { title: 'Remove reading', kind: 'warning' });
    }
  } catch (e) { console.debug('[confirm] dialog ask failed', e); }
  return window.confirm(message);
}
function exitFullscreen() {
  const desk = document.getElementById('desk');
  if (!desk.classList.contains('fs')) return;
  desk.classList.remove('fs');
  const lbl = document.getElementById('fs-label');
  if (lbl) lbl.textContent = 'focus';
  // the column changed width — re-fit the page
  const entry = openBooks.get(activeReadingPath);
  if (entry && entry.pdfCtl) requestAnimationFrame(() => entry.pdfCtl.relayout());
}
function toggleFullscreen() {
  const desk = document.getElementById('desk');
  const on = desk.classList.toggle('fs');
  const lbl = document.getElementById('fs-label');
  if (lbl) lbl.textContent = on ? 'exit focus' : 'focus';
  const entry = openBooks.get(activeReadingPath);
  if (entry && entry.pdfCtl) requestAnimationFrame(() => entry.pdfCtl.relayout());
}
// ---- Feynman Gate: produce a synthesis before closing a book ----
{
  const feynmanScrim = document.getElementById('feynman-scrim');
  let feynmanPath = null;
  let feynmanFm   = null;

  function closeFeynman() {
    if (feynmanScrim) feynmanScrim.classList.remove('on');
    feynmanPath = null; feynmanFm = null;
  }

  async function markBound(relPath, fm) {
    if (!window.Bridge) return;
    try {
      const note = await window.Bridge.notes.readParsed(relPath);
      const liveFm = Object.assign({}, (note && note.frontmatter) || fm, { status: 'bound', bound_on: new Date().toISOString().slice(0, 10) });
      await window.Bridge.notes.write(relPath, liveFm, (note && note.body) || '');
      closeBook(relPath);
      loadReadingsList();
      window.flash?.('bound · ' + (liveFm.title || relPath.split('/').pop()));
      loadThresholdCard();
    } catch(e) { console.debug('[mark-bound]', e); }
  }

  document.getElementById('reader-bound')?.addEventListener('click', async () => {
    const relPath = activeReadingPath;
    if (!relPath || !window.Bridge) return;
    let fm = {};
    try { const n = await window.Bridge.notes.readParsed(relPath); fm = (n && n.frontmatter) || {}; } catch(e) {}
    if (fm.synthesis_note) { await markBound(relPath, fm); return; }
    feynmanPath = relPath; feynmanFm = fm;
    const titleEl = document.getElementById('feynman-title');
    const subEl   = document.getElementById('feynman-sub');
    if (titleEl) titleEl.textContent = 'Before you close "' + (fm.title || 'this book') + '"';
    if (subEl)   subEl.textContent   = '— ' + (fm.why ? '"' + fm.why.slice(0, 80) + '"' : 'in your own words') + ' —';
    document.getElementById('feynman-text').value = '';
    feynmanScrim.classList.add('on');
    setTimeout(() => document.getElementById('feynman-text')?.focus(), 60);
  });

  document.getElementById('feynman-skip')?.addEventListener('click', async () => {
    const relPath = feynmanPath; const fm = feynmanFm;
    closeFeynman();
    if (relPath) await markBound(relPath, fm || {});
  });

  document.getElementById('feynman-save')?.addEventListener('click', async () => {
    const relPath = feynmanPath; const fm = feynmanFm || {};
    const explanation = (document.getElementById('feynman-text')?.value || '').trim();
    closeFeynman();
    if (!relPath) return;
    if (explanation && window.Bridge) {
      const today = new Date().toISOString().slice(0, 10);
      const title = fm.title || relPath.split('/').pop().replace('.md', '');
      const slug = 'synthesis-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 36) + '-' + Date.now().toString(36);
      const synthFm = {
        type: 'synthesis', subtype: 'feynman',
        created: today,
        source: relPath,
        source_title: title,
        why: fm.why || explanation.slice(0, 120),
        review: { due: addDaysISO(today, 1), interval: 1 },
      };
      try {
        const synthRel = await window.Bridge.notes.create('Notes', slug, synthFm, explanation);
        const readNote = await window.Bridge.notes.readParsed(relPath).catch(() => null);
        const readFm = Object.assign({}, (readNote && readNote.frontmatter) || fm, { synthesis_note: synthRel });
        await window.Bridge.notes.write(relPath, readFm, (readNote && readNote.body) || '');
      } catch(e) { console.debug('[feynman-save]', e); }
    }
    await markBound(relPath, fm);
  });

  feynmanScrim?.addEventListener('click', (e) => { if (e.target === feynmanScrim) closeFeynman(); });
}

{
  document.getElementById('zoom-in')?.addEventListener('click',  () => zoomActive(1));
  document.getElementById('zoom-out')?.addEventListener('click', () => zoomActive(-1));
  document.getElementById('zoom-val')?.addEventListener('click', () => zoomActive(0));   // click % to reset
  document.getElementById('reader-fs')?.addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') exitFullscreen();
  });

  const rm = document.getElementById('reader-remove');
  if (rm) rm.addEventListener('click', async () => {
    const relPath = activeReadingPath;
    if (!relPath) return;
    const entry = openBooks.get(relPath);
    const name = (entry && entry.fm && entry.fm.title) || relPath.split('/').pop();
    if (!window.Bridge) { window.flash?.('removal available in the Tauri app'); return; }
    const ok = await confirmRemoval(
      'Remove “' + name + '” from the shelf?\n\nThe note and its PDF move to the vault’s .trash folder (recoverable), not erased.');
    if (!ok) return;
    try {
      await window.Bridge.pdf.remove(relPath);
      closeBook(relPath);                       // pulls it off the desk + tabs
      const spine = document.querySelector('#shelf-books .spine-book[data-path="' +
        (window.CSS && CSS.escape ? CSS.escape(relPath) : relPath) + '"]');
      if (spine) spine.remove();
      window.flash?.('removed · ' + name);
      loadReadingsList();
    } catch (e) {
      console.debug('[remove-reading]', e);
      window.flash?.('could not remove');
    }
  });
}

// ---- Loop 4: Highlight → Why — save to vault ----
// The IIFE's capsave handler runs first (DOM mark + note), then this handler saves to vault.
{
  const saveBtn = document.getElementById('capsave');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!activeReadingPath || !window.Bridge) return;
      const why   = (document.getElementById('captext')?.value || '').trim();
      const quote = window._savedHighlightText || '';
      if (!quote) return;
      const today = new Date().toISOString().slice(0, 10);
      const hl = {
        anchor:  { page: 1, quote: quote.slice(0, 200) },
        why,
        created: today,
        // enter the spaced-resurfacing schedule (Mnemosyne) — the 'why' is the key
        review:  { due: addDaysISO(today, 1), interval: 1 },
      };
      try {
        await window.Bridge.pdf.saveHighlight(activeReadingPath, hl);
        // Bridge check: find semantically similar notes to queue a connection prompt
        const checkText = (why || quote).slice(0, 300);
        if (checkText.trim() && window.Bridge?.search?.find) {
          window.Bridge.search.find(checkText, 3).then(hits => {
            const close = (hits || []).filter(h => (h.score || 0) >= 0.65 && h.path !== activeReadingPath);
            if (close.length > 0) {
              const bq = JSON.parse(localStorage.getItem('rm-bridge-queue') || '[]');
              bq.push({ source1: activeReadingPath, source2: close[0].path, matchTitle: close[0].title || close[0].path, text: (why || quote.slice(0, 120)) });
              localStorage.setItem('rm-bridge-queue', JSON.stringify(bq.slice(-3)));
            }
          }).catch(() => {});
        }
      } catch(e) {
        console.debug('[highlight-save]', e);
      }
    });
  }
}

// ---- Proactive bootstrap ----------------------------------------------------
// Rust's setup() emits `vault-ready`/`show-vault-picker` from a spawned task that
// can fire BEFORE this webview registers its listeners (a startup race). So we
// also ask the backend directly on load. Loaders are idempotent reads, so if the
// event does arrive too, running them twice is harmless.
if (IS_TAURI) {
  (async () => {
    try {
      const path = await window.Bridge.vault.getPath();
      const ov = document.getElementById('vault-overlay');
      if (path) {
        if (ov) ov.style.display = 'none';
        clearDemoScaffold();
        if (window.RM_maybeOnboard) window.RM_maybeOnboard(path);
        loadThresholdCard();
        loadThresholdGoal();
        loadMomentumLine();
        loadLifeStats();
        loadThreadCard().then(() => { loadResurface(); loadBridgePrompt(); });
        loadEpigraph();
        loadRabbitHole();
        loadIntentions();
        loadTasks();
        loadInboxCount();
        loadReadingsList();
        if (window.RM_loadPursuits) window.RM_loadPursuits();
        if (window.RM_loadGoalsFromVault) window.RM_loadGoalsFromVault();
        if (window.RM_loadThreadsIntoSky) window.RM_loadThreadsIntoSky();
        if (window.RM_loadGym) window.RM_loadGym();
        if (window.RM_loadCabinet) window.RM_loadCabinet();
        if (window.RM_loadWorks) window.RM_loadWorks();
        if (window.RM_loadDepth) window.RM_loadDepth();
        if (window.RM_loadFeats) window.RM_loadFeats();
        if (window.RM_loadLifeDays) window.RM_loadLifeDays();
        if (window.RM_loadStudy) window.RM_loadStudy();
      } else if (ov) {
        ov.style.display = 'flex';
      }
    } catch (e) { console.debug('[bootstrap]', e); }
  })();
}
