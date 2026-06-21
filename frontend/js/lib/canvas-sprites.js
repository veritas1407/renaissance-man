// Pre-bakes star glows and nebula clouds into OffscreenCanvas sprites.
// Call bakeAll() once at atlas init. Then use drawImage() in the render loop —
// never call createRadialGradient inside requestAnimationFrame.

const CACHE = new Map();

export function bakeStarSprite(magnitude = 3, color = '#f8f0d8') {
  const key = `star-${magnitude}-${color}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const radius = Math.max(1.5, 5.5 - magnitude * 0.9);
  const glowR  = radius * 5;
  const size   = Math.ceil(glowR * 2 + 4);

  const oc = new OffscreenCanvas(size, size);
  const ctx = oc.getContext('2d');
  const cx  = size / 2;

  // Outer glow (baked once — never inside rAF)
  const grd = ctx.createRadialGradient(cx, cx, 0, cx, cx, glowR);
  grd.addColorStop(0,   color + 'ff');
  grd.addColorStop(0.2, color + '99');
  grd.addColorStop(1,   color + '00');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  // Hard star core
  ctx.fillStyle = '#fffdf0';
  ctx.beginPath();
  ctx.arc(cx, cx, Math.max(0.6, radius * 0.35), 0, Math.PI * 2);
  ctx.fill();

  CACHE.set(key, oc);
  return oc;
}

export function bakeGuidingHalo(radius = 28) {
  const key = `halo-${radius}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const size = radius * 2 + 8;
  const oc   = new OffscreenCanvas(size, size);
  const ctx  = oc.getContext('2d');
  const cx   = size / 2;

  // Vermilion guiding-star halo (long-term goals per spec)
  const grd = ctx.createRadialGradient(cx, cx, radius * 0.5, cx, cx, radius);
  grd.addColorStop(0, 'rgba(158,51,32,0.0)');
  grd.addColorStop(0.6, 'rgba(158,51,32,0.18)');
  grd.addColorStop(1, 'rgba(158,51,32,0.0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  CACHE.set(key, oc);
  return oc;
}

export function bakeNebulaSprite(width, height) {
  const key = `nebula-${width}-${height}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const oc  = new OffscreenCanvas(width, height);
  const ctx = oc.getContext('2d');

  // Deep night background
  ctx.fillStyle = '#070a16';
  ctx.fillRect(0, 0, width, height);

  // Soft nebula clouds at domain regions
  const regions = [
    { x: width * 0.2, y: height * 0.3, r: width * 0.22, h: 220 },
    { x: width * 0.7, y: height * 0.5, r: width * 0.18, h: 200 },
    { x: width * 0.5, y: height * 0.15, r: width * 0.15, h: 240 },
    { x: width * 0.85, y: height * 0.75, r: width * 0.12, h: 180 },
  ];

  for (const reg of regions) {
    const grd = ctx.createRadialGradient(reg.x, reg.y, 0, reg.x, reg.y, reg.r);
    grd.addColorStop(0, `hsla(${reg.h},30%,16%,0.4)`);
    grd.addColorStop(1, 'hsla(0,0%,0%,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
  }

  CACHE.set(key, oc);
  return oc;
}

// Bake everything needed at init — call once before first frame
export function bakeAll(canvasW, canvasH) {
  bakeNebulaSprite(canvasW, canvasH);
  bakeGuidingHalo(28);
  bakeGuidingHalo(40);
  // Five magnitude tiers × two color temperatures
  for (let m = 1; m <= 5; m++) {
    bakeStarSprite(m, '#f8f0d8');  // warm white (most stars)
    bakeStarSprite(m, '#d4c5a9');  // golden-warm (done rungs)
    bakeStarSprite(m, '#a8c4e0');  // cool blue (knowledge domain)
  }
}

export { CACHE };
