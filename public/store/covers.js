/* covers.js — canvas cover art for the 3D specialist bookstore.
   Draws front / back / spine / page-edge artwork onto fresh HTMLCanvasElements that the
   WebGL layer wraps as textures. Pure 2D canvas: no three.js, no DOM insertion, no deps. */

import { ECO_COLORS } from './data.js';

const SERIF = '"Playfair Display", Georgia, serif';
const SANS = '"DM Sans", system-ui, sans-serif';
const CREAM = '#e8dcc0';
const PAPER = '#f4ecdc';
const INK = '#3a3a35';
const INK_SOFT = '#4a463d';
const DEFAULT_ECO = '#0b4bad';

const COVER_W = 384;
const COVER_H = 576;
const SPINE_W = 48;

const ecoColor = (eco) => (ECO_COLORS && ECO_COLORS[eco]) || DEFAULT_ECO;

/* ---------- shared helpers ---------- */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Crisp 1px-ish rule: snapped to a half pixel so it never renders as a soft 2px smear. */
function hairline(ctx, x1, x2, y, color, alpha, scale) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1, scale);
  ctx.beginPath();
  ctx.moveTo(x1, Math.round(y) + 0.5);
  ctx.lineTo(x2, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.restore();
}

function doubleRule(ctx, w, h, color, scale) {
  const i1 = Math.round(12 * scale);
  const i2 = Math.round(18 * scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 2 * scale); ctx.globalAlpha = 0.95;
  ctx.strokeRect(i1, i1, w - i1 * 2, h - i1 * 2);
  ctx.lineWidth = Math.max(1, scale); ctx.globalAlpha = 0.6;
  ctx.strokeRect(i2, i2, w - i2 * 2, h - i2 * 2);
  ctx.globalAlpha = 1;
}

function wrapText(ctx, text, maxWidth) {
  const out = [];
  const src = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!src) return out;
  let line = '';
  for (let word of src.split(' ')) {
    // A single word wider than the column gets hard-broken so nothing ever overflows.
    while (ctx.measureText(word).width > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > maxWidth) cut--;
      if (line) { out.push(line); line = ''; }
      out.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const test = line ? line + ' ' + word : word;
    if (line && ctx.measureText(test).width > maxWidth) { out.push(line); line = word; }
    else line = test;
  }
  if (line) out.push(line);
  return out;
}

function ellipsize(ctx, text, maxWidth) {
  let t = String(text || '');
  if (ctx.measureText(t + '…').width <= maxWidth) return t + '…';
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t.replace(/[\s,;:.\-]+$/, '') + '…';
}

function clampLines(ctx, lines, maxLines, maxWidth) {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(ctx, kept[maxLines - 1], maxWidth);
  return kept;
}

function fitFont(ctx, text, family, weight, startPx, minPx, maxWidth) {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(String(text || '')).width <= maxWidth) return px;
    px -= 1;
  }
  ctx.font = `${weight} ${minPx}px ${family}`;
  return minPx;
}

/** Letter-spaced text drawn glyph-by-glyph — ctx.letterSpacing is still uneven across engines. */
function drawTracked(ctx, text, cx, y, spacing) {
  const chars = Array.from(String(text || ''));
  if (!chars.length) return;
  let total = -spacing;
  for (const ch of chars) total += ctx.measureText(ch).width + spacing;
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + spacing; }
  ctx.textAlign = prevAlign;
}

function coverFitDraw(ctx, img, x, y, w, h, radius, focusY = 0.42) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const k = Math.max(w / iw, h / ih);
  const dw = iw * k;
  const dh = ih * k;
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  // focusY biases the crop upward so faces keep their headroom instead of centering on the torso.
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * focusY, dw, dh);
  ctx.restore();
}

const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v|vi|vii|md|do|dds|cpa|cfp|cfa|jd|llm|esq|phd|mba|ea|clu|chfc|cima|aif|ricp|cpwa)$/i;

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/)
    .map((p) => p.replace(/[^\p{L}'-]/gu, ''))
    .filter(Boolean);
  // Trailing generational/credential tokens are not surnames: "Abernathy III" must read A, not I.
  while (parts.length > 1 && NAME_SUFFIX.test(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
  return (first + last).toUpperCase();
}

function paragraphsOf(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

/* ---------- headshots ---------- */

const headshotCache = new Map();

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    // Required: an anonymous-CORS image keeps the canvas untainted so WebGL can upload it.
    // A host without CORS headers therefore fails to load — deliberate, we fall back to the
    // monogram plate rather than poisoning the texture pipeline.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function loadHeadshot(spec) {
  if (!spec) return null;
  const key = spec.id;
  if (headshotCache.has(key)) return headshotCache.get(key);
  const pending = (async () => {
    for (const url of [spec.headshotUrl, spec.headshotFallback]) {
      if (!url) continue;
      const img = await loadImage(url);
      if (!img) continue;
      try { await img.decode(); } catch (_) { /* already decoded via onload on most engines */ }
      return img;
    }
    return null;
  })();
  headshotCache.set(key, pending); // caches the null outcome too — no retry storms
  return pending;
}

/* ---------- fonts ---------- */

const FONT_FACES = [
  '700 64px "Playfair Display"',
  '600 40px "Playfair Display"',
  '400 28px "DM Sans"',
  '500 28px "DM Sans"',
  '700 28px "DM Sans"',
];

let fontsPromise = null;

export async function ensureFonts() {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return;
    for (const face of FONT_FACES) {
      try { await document.fonts.load(face); } catch (_) { /* face unavailable; stack falls back */ }
    }
    try { await document.fonts.ready; } catch (_) { /* no-op */ }
  })();
  return fontsPromise;
}

/* ---------- front cover ---------- */

export async function drawFrontCover(spec, eco, scale = 1) {
  await ensureFonts();
  const img = await loadHeadshot(spec);

  const u = (n) => n * scale;
  const r = (n) => Math.round(n * scale);
  const W = Math.round(COVER_W * scale);
  const H = Math.round(COVER_H * scale);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const base = ecoColor(eco);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const vig = ctx.createRadialGradient(W / 2, H * 0.42, W * 0.10, W / 2, H * 0.52, H * 0.80);
  vig.addColorStop(0, 'rgba(255,255,255,0.10)');
  vig.addColorStop(0.55, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.40)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  doubleRule(ctx, W, H, CREAM, scale);

  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${u(13)}px ${SANS}`; ctx.globalAlpha = 0.9;
  drawTracked(ctx, String(eco || '').toUpperCase(), W / 2, r(48), u(2.6));
  ctx.globalAlpha = 1;

  // Portrait plate: cream frame + drop shadow, image center-cropped square inside it.
  const plate = r(200);
  const px = Math.round((W - plate) / 2);
  const py = r(84);
  const frame = r(5);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)'; ctx.shadowBlur = u(14); ctx.shadowOffsetY = u(5);
  ctx.fillStyle = CREAM;
  roundRect(ctx, px - frame, py - frame, plate + frame * 2, plate + frame * 2, r(12));
  ctx.fill();
  ctx.restore();

  if (img) {
    coverFitDraw(ctx, img, px, py, plate, plate, r(8));
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    roundRect(ctx, px, py, plate, plate, r(8));
    ctx.fill();
    const mono = initialsOf(spec && spec.name);
    ctx.fillStyle = CREAM;
    fitFont(ctx, mono, SERIF, 700, u(86), u(44), plate - u(48));
    ctx.fillText(mono, px + plate / 2, py + plate / 2 + u(4));
  }

  // Name — largest size from 34 down to 22 that lands in two lines or fewer.
  const textW = W - r(56);
  let nameSize = u(22);
  let nameLines = [];
  for (let s = 34; s >= 22; s -= 1) {
    ctx.font = `700 ${u(s)}px ${SERIF}`;
    nameSize = u(s);
    nameLines = wrapText(ctx, spec && spec.name, textW);
    if (nameLines.length <= 2) break;
  }
  ctx.font = `700 ${nameSize}px ${SERIF}`;
  nameLines = clampLines(ctx, nameLines, 2, textW);

  ctx.fillStyle = CREAM; ctx.textBaseline = 'alphabetic';
  const nameLH = nameSize * 1.16;
  let y = py + plate + r(52);
  for (const line of nameLines) { ctx.fillText(line, W / 2, Math.round(y)); y += nameLH; }

  const ruleY = Math.round(y - nameLH + u(20));
  hairline(ctx, W / 2 - r(44), W / 2 + r(44), ruleY, CREAM, 0.55, scale);

  ctx.font = `400 ${u(15)}px ${SANS}`;
  ctx.fillStyle = CREAM; ctx.globalAlpha = 0.8;
  let ty = ruleY + u(30);
  for (const line of clampLines(ctx, wrapText(ctx, spec && spec.shortBio, textW), 3, textW)) {
    ctx.fillText(line, W / 2, Math.round(ty));
    ty += u(21);
  }

  ctx.font = `700 ${u(10.5)}px ${SANS}`; ctx.globalAlpha = 0.6; ctx.textBaseline = 'middle';
  drawTracked(ctx, 'VFO SPECIALISTS', W / 2, H - r(40), u(3));
  ctx.globalAlpha = 1;

  return canvas;
}

/* ---------- back cover ---------- */

export async function drawBackCover(spec, eco, scale = 1) {
  await ensureFonts();

  const u = (n) => n * scale;
  const r = (n) => Math.round(n * scale);
  const W = Math.round(COVER_W * scale);
  const H = Math.round(COVER_H * scale);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const base = ecoColor(eco);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  doubleRule(ctx, W, H, base, scale);

  const bandX = r(19);
  const bandY = r(19);
  const bandW = W - bandX * 2;
  const bandH = r(48);
  ctx.fillStyle = base;
  ctx.fillRect(bandX, bandY, bandW, bandH);
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitFont(ctx, spec && spec.name, SERIF, 600, u(23), u(12), bandW - u(28));
  ctx.fillText(String((spec && spec.name) || ''), W / 2, bandY + bandH / 2 + u(1));

  const bodyX = r(34);
  const bodyW = W - bodyX * 2;
  const footerTop = H - r(56);
  const limitY = footerTop - u(16);
  let y = bandY + bandH + r(30);

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = `500 ${u(15)}px ${SANS}`;
  for (const line of clampLines(ctx, wrapText(ctx, spec && spec.shortBio, bodyW), 4, bodyW)) {
    ctx.fillText(line, bodyX, Math.round(y));
    y += u(21);
  }

  const paras = paragraphsOf(spec && spec.longBio);

  // Divider: full width when a long bio follows, a short centered ornament when it doesn't.
  const divY = Math.round(y + u(6));
  if (paras.length) hairline(ctx, bodyX, bodyX + bodyW, divY, INK, 0.22, scale);
  else hairline(ctx, W / 2 - r(26), W / 2 + r(26), divY, INK, 0.22, scale);
  y = divY + u(22);

  if (paras.length) {
    const layout = (size) => {
      ctx.font = `400 ${size}px ${SANS}`;
      const out = [];
      paras.forEach((p, i) => {
        if (i) out.push(''); // blank slot = paragraph break
        for (const l of wrapText(ctx, p, bodyW)) out.push(l);
      });
      return out;
    };

    let size = u(13.5);
    let lines = layout(size);
    let lh = size * 1.45;
    let capacity = Math.max(0, Math.floor((limitY - y) / lh));
    if (capacity < lines.length * 0.4) {
      size = u(12.5);
      lines = layout(size);
      lh = size * 1.45;
      capacity = Math.max(0, Math.floor((limitY - y) / lh));
    }

    const truncated = lines.length > capacity;
    let shown = lines;
    if (truncated) {
      shown = lines.slice(0, Math.max(1, Math.floor((limitY - u(24) - y) / lh)));
      while (shown.length > 1 && !shown[shown.length - 1]) shown.pop(); // never end on a gap slot
    }

    ctx.font = `400 ${size}px ${SANS}`;
    ctx.fillStyle = INK_SOFT;
    shown.forEach((line, i) => {
      if (line) {
        const text = truncated && i === shown.length - 1 ? ellipsize(ctx, line, bodyW) : line;
        ctx.fillText(text, bodyX, Math.round(y));
      }
      y += lh;
    });

    if (truncated) {
      ctx.font = `700 ${u(11)}px ${SANS}`;
      ctx.fillStyle = base; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.85;
      drawTracked(ctx, 'FULL PROFILE — PRESS "READ PROFILE"', W / 2, footerTop - u(16), u(0.8));
      ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }

  hairline(ctx, bodyX, bodyX + bodyW, footerTop, INK, 0.16, scale);

  const cats = Array.isArray(spec && spec.categories) ? spec.categories.filter(Boolean) : [];
  if (cats.length) {
    ctx.font = `700 ${u(10.5)}px ${SANS}`;
    const padX = u(9);
    const gap = u(6);
    const chipH = r(20);
    const rowMax = W - r(48);
    const widthOf = (t) => ctx.measureText(String(t).toUpperCase()).width + padX * 2;

    const chips = [];
    let used = 0;
    for (const c of cats) {
      const w = widthOf(c);
      const add = chips.length ? gap + w : w;
      if (used + add > rowMax) break;
      chips.push({ label: String(c).toUpperCase(), w });
      used += add;
    }
    let extra = cats.length - chips.length;
    if (extra > 0) {
      // Drop chips until the "+N" overflow marker itself fits on the row.
      let plusW = widthOf('+' + extra);
      while (chips.length && used + gap + plusW > rowMax) {
        const popped = chips.pop();
        used -= popped.w + (chips.length ? gap : 0);
        extra = cats.length - chips.length;
        plusW = widthOf('+' + extra);
      }
      chips.push({ label: '+' + extra, w: plusW });
      used += (chips.length > 1 ? gap : 0) + plusW;
    }

    let cx = Math.round((W - used) / 2);
    const cy = Math.round(H - r(31) - chipH / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const chip of chips) {
      ctx.fillStyle = base;
      roundRect(ctx, cx, cy, Math.round(chip.w), chipH, chipH / 2);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.fillText(chip.label, cx + chip.w / 2, cy + chipH / 2 + u(0.5));
      cx += chip.w + gap;
    }
  }

  return canvas;
}

/* ---------- spine ---------- */

export function drawSpine(spec, eco, scale = 1) {
  ensureFonts(); // warms the cache; the spine is often the first thing drawn
  const u = (n) => n * scale;
  const r = (n) => Math.round(n * scale);
  const W = Math.round(SPINE_W * scale);
  const H = Math.round(COVER_H * scale);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const base = ecoColor(eco);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const shade = ctx.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.34)');
  shade.addColorStop(0.42, 'rgba(255,255,255,0.08)');
  shade.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  const cap = r(34);
  const hair = Math.max(1, r(1));
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, cap);
  ctx.fillRect(0, H - cap, W, cap);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, cap, W, hair);
  ctx.fillRect(0, H - cap - hair, W, hair);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitFont(ctx, spec && spec.name, SERIF, 600, u(22), u(9), H - cap * 2 - u(30));
  ctx.fillText(String((spec && spec.name) || ''), 0, u(0.5));
  ctx.restore();

  ctx.fillStyle = base; ctx.font = `700 ${u(9)}px ${SANS}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  drawTracked(ctx, 'VFO', W / 2, H - cap / 2, u(1.4));

  return canvas;
}

/* ---------- page edges ---------- */

let pagesCanvas = null;

export function drawPagesTexture() {
  if (pagesCanvas) return pagesCanvas;
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f3ecda';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(120,105,80,0.22)' : 'rgba(120,105,80,0.11)';
    ctx.fillRect(0, y, 64, 1);
  }
  const edge = ctx.createLinearGradient(0, 0, 64, 0);
  edge.addColorStop(0, 'rgba(90,78,56,0.20)');
  edge.addColorStop(0.25, 'rgba(0,0,0,0)');
  edge.addColorStop(0.75, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(90,78,56,0.20)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 64, 64);
  pagesCanvas = c;
  return c;
}
