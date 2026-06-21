// Atlas room — living cosmos canvas.
// Replaces the prototype's SVG implementation with a sprite-baked canvas
// per the architectural spec: no createRadialGradient inside rAF.

import { bakeAll, bakeStarSprite, bakeNebulaSprite, bakeGuidingHalo, CACHE } from '../lib/canvas-sprites.js';

const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

let canvas, ctx;
let goals = [];           // array of ParsedNote objects from Goals/
let pan   = { x: 0, y: 0 };
let zoom  = 1;
let selected  = null;    // currently focused goal
let animFrame = null;
let focusAnim = null;    // { target: {x,y,z}, start, duration }

// Domain → sector center (ra, dec) for procedural layout
const DOMAIN_SECTORS = {
  mathematics: { ra: 0.18, dec: 0.30 },
  physics:     { ra: 0.40, dec: 0.20 },
  mind:        { ra: 0.62, dec: 0.35 },
  letters:     { ra: 0.25, dec: 0.65 },
  body:        { ra: 0.75, dec: 0.60 },
  craft:       { ra: 0.50, dec: 0.55 },
  spirit:      { ra: 0.85, dec: 0.25 },
  travel:      { ra: 0.10, dec: 0.70 },
};

export function init(canvasEl, goalData) {
  canvas = canvasEl;
  resize();
  bakeAll(canvas.width / DPR, canvas.height / DPR);

  goals = goalData;
  assignCoordinates(goals);

  // Pan/zoom interactions
  let dragging = false, lastPt = null;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastPt = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    pan.x += e.clientX - lastPt.x;
    pan.y += e.clientY - lastPt.y;
    lastPt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    zoom = Math.max(0.4, Math.min(6, zoom * factor));
  }, { passive: false });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left);
    const my = (e.clientY - rect.top);
    hitTestGoal(mx, my);
  });

  window.addEventListener('resize', resize);
  if (animFrame) cancelAnimationFrame(animFrame);
  renderLoop();
}

function resize() {
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  canvas.width  = w * DPR;
  canvas.height = h * DPR;
  ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  // Re-bake nebula on resize (it's size-dependent)
  CACHE.delete(`nebula-${w}-${h}`);
  bakeNebulaSprite(w, h);
}

// Convert normalized (0-1) coordinates to screen pixels
function worldToScreen(ra, dec) {
  const W = canvas.width  / DPR;
  const H = canvas.height / DPR;
  return {
    x: ra  * W * zoom + pan.x,
    y: dec * H * zoom + pan.y,
  };
}

// Assign (ra, dec) from frontmatter or generate from domain hash
function assignCoordinates(goalList) {
  goalList.forEach((g, i) => {
    const fm = g.frontmatter || {};
    if (fm.atlas_position?.ra != null) {
      g._ra  = fm.atlas_position.ra;
      g._dec = fm.atlas_position.dec;
    } else {
      const domain = fm.domain || 'mind';
      const sector = DOMAIN_SECTORS[domain] || { ra: 0.5, dec: 0.5 };
      // Deterministic jitter based on slug hash
      const slug = (fm.title || String(i)).toLowerCase().replace(/\W/g, '');
      const hash = slug.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0);
      g._ra  = sector.ra  + ((hash & 0xff) / 255 - 0.5) * 0.15;
      g._dec = sector.dec + (((hash >> 8) & 0xff) / 255 - 0.5) * 0.12;
      g._ra  = Math.max(0.05, Math.min(0.95, g._ra));
      g._dec = Math.max(0.05, Math.min(0.95, g._dec));
    }

    // Build star positions for each rung along a mini-constellation
    const rungs = fm.rungs || [];
    g._stars = rungs.map((rung, ri) => {
      const angle = (ri / Math.max(rungs.length - 1, 1)) * Math.PI * 1.2 - 0.6;
      const spread = 0.04 + ri * 0.005;
      return {
        ra:  g._ra  + Math.cos(angle) * spread,
        dec: g._dec + Math.sin(angle) * spread * 0.6,
        state: rung.complete ? 'done' : 'future',
        label: rung.t || '',
        rungIdx: ri,
      };
    });

    // Mark current (first incomplete) star
    const curIdx = g._stars.findIndex(s => s.state === 'future');
    if (curIdx >= 0) g._stars[curIdx].state = 'cur';
  });
}

function renderLoop() {
  animFrame = requestAnimationFrame(renderLoop);
  draw();
}

let twinklePh = 0;
function draw() {
  const W = canvas.width  / DPR;
  const H = canvas.height / DPR;
  twinklePh += 0.018;

  ctx.clearRect(0, 0, W, H);

  // Nebula background (pre-baked)
  const nebula = CACHE.get(`nebula-${W}-${H}`);
  if (nebula) ctx.drawImage(nebula, 0, 0, W, H);

  // Faint background star field
  drawBackground(W, H);

  // Gravitational pathways (dashed arcs between related goals, low opacity)
  if (zoom < 2) drawGravitationalPaths();

  // Constellation lines first (below stars)
  goals.forEach(g => drawConstellationLines(g));

  // Stars
  goals.forEach(g => drawGoalStars(g));

  // Labels when zoomed in
  if (zoom > 1.2) goals.forEach(g => drawGoalLabel(g));

  // Cartouche for selected goal
  if (selected) drawCartouche(selected, W, H);
}

// Static background star field — only redraws positions on resize
const BG_STARS = Array.from({ length: 180 }, () => ({
  ra:  Math.random(),
  dec: Math.random(),
  mag: 3 + Math.random() * 2,
}));

function drawBackground(W, H) {
  for (const s of BG_STARS) {
    const { x, y } = worldToScreen(s.ra, s.dec);
    if (x < -5 || x > W + 5 || y < -5 || y > H + 5) continue;
    const sprite = bakeStarSprite(s.mag, '#a8c4e0');
    const hw = sprite.width / 2;
    ctx.globalAlpha = 0.35;
    ctx.drawImage(sprite, x - hw, y - hw);
    ctx.globalAlpha = 1;
  }
}

function drawConstellationLines(g) {
  if (!g._stars || g._stars.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(217,182,90,0.28)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  g._stars.forEach((s, i) => {
    const { x, y } = worldToScreen(s.ra, s.dec);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawGoalStars(g) {
  if (!g._stars) return;
  g._stars.forEach(s => {
    const { x, y } = worldToScreen(s.ra, s.dec);
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;

    const isCur = s.state === 'cur';
    const isDone = s.state === 'done';

    const color = isDone ? '#d9b65a' : isCur ? '#f8f0d8' : '#5e5848';
    const mag   = isDone ? 2.5 : isCur ? 1.5 : 4;
    const sprite = bakeStarSprite(mag, color);
    const hw = sprite.width / 2;

    // Twinkle on current star
    const alpha = isCur ? 0.7 + 0.3 * Math.sin(twinklePh * 2) : 1.0;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - hw, y - hw);
    ctx.globalAlpha = 1;

    // Guiding halo for goal type "guiding star"
    if (g.frontmatter?.kind === 'numeric' && isCur) {
      const halo = CACHE.get('halo-28');
      if (halo) {
        const hh = halo.width / 2;
        ctx.globalAlpha = 0.6;
        ctx.drawImage(halo, x - hh, y - hh);
        ctx.globalAlpha = 1;
      }
    }
  });
}

function drawGoalLabel(g) {
  if (!g._ra) return;
  const { x, y } = worldToScreen(g._ra, g._dec);
  const W = canvas.width / DPR;
  const H = canvas.height / DPR;
  if (x < -60 || x > W + 60 || y < -20 || y > H + 20) return;

  ctx.save();
  ctx.fillStyle = 'rgba(231,217,184,0.7)';
  ctx.font = `${11 * Math.min(zoom, 2)}px "IM Fell English", serif`;
  ctx.textAlign = 'center';
  ctx.fillText(g.frontmatter?.title || '', x, y + 20 * zoom);
  ctx.restore();
}

function drawGravitationalPaths() {
  // Draw dashed arcs between goals that share a domain (future: tag-based)
  const pairs = [];
  for (let i = 0; i < goals.length - 1; i++) {
    for (let j = i + 1; j < goals.length; j++) {
      if (goals[i].frontmatter?.domain === goals[j].frontmatter?.domain) {
        pairs.push([goals[i], goals[j]]);
      }
    }
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(169,132,47,0.12)';
  ctx.lineWidth   = 0.6;
  ctx.setLineDash([2, 8]);
  for (const [a, b] of pairs) {
    const pa = worldToScreen(a._ra, a._dec);
    const pb = worldToScreen(b._ra, b._dec);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCartouche(g, W, H) {
  const fm = g.frontmatter || {};
  const title = fm.title || '';
  const rungs = fm.rungs || [];
  const curRung = rungs.find(r => !r.complete);
  const rungText = curRung?.t || 'all rungs complete';

  const x = W - 280, y = 60, w = 240, h = 120;
  ctx.save();
  ctx.fillStyle = 'rgba(231,217,184,0.92)';
  ctx.strokeStyle = '#a9842f';
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#33271a';
  ctx.font = `bold 14px "Cormorant Garamond", serif`;
  ctx.fillText(title, x + 14, y + 24);

  ctx.font = `11px "IM Fell English", serif`;
  ctx.fillStyle = '#5e4d36';
  wrapText(ctx, `Next: ${rungText}`, x + 14, y + 46, w - 28, 16);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

function hitTestGoal(mx, my) {
  for (const g of goals) {
    if (!g._stars) continue;
    for (const s of g._stars) {
      const { x, y } = worldToScreen(s.ra, s.dec);
      const dist = Math.hypot(mx - x, my - y);
      if (dist < 14) {
        selected = g;
        return;
      }
    }
  }
  selected = null;
}

export async function lightStar(goalPath, rungIndex) {
  if (!window.Bridge) return;
  const note = await window.Bridge.notes.readParsed(goalPath);
  if (!note?.frontmatter?.rungs) return;
  note.frontmatter.rungs[rungIndex].complete = true;
  note.frontmatter.last_touched = new Date().toISOString().split('T')[0];
  note.frontmatter.temp = 'warm';
  await window.Bridge.notes.write(goalPath, note.frontmatter, note.body);
  // Re-fetch and re-render
  const updated = await window.Bridge.notes.readParsed(goalPath);
  const idx = goals.findIndex(g => g._path === goalPath);
  if (idx >= 0) {
    goals[idx] = updated;
    goals[idx]._path = goalPath;
  }
  assignCoordinates(goals);
}
