/* textures.js — procedural surface textures for the VFO Library bookshop (standalone /store page).
   Pure 2D canvas: every export returns an HTMLCanvasElement that the engine wraps in a
   THREE.CanvasTexture. Built in layers (base -> low-freq mottle -> material structure -> fine grain
   -> edge shading) and module-cached, so repeat calls return the same canvas and colour/roughness
   pairs stay pixel-aligned. */

function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0)
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (a) => a[(Math.random() * a.length) | 0]
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const scaleRgb = (c, f) => [clamp255(c[0] * f), clamp255(c[1] * f), clamp255(c[2] * f)]
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

function hexRgb(hex) {
  let s = String(hex).replace('#', '')
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
  const n = parseInt(s, 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const grad = (ctx, x0, y0, x1, y1, stops) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

const smoothstep = (t) => t * t * (3 - 2 * t)

// Multi-octave value noise on a wrapping lattice: sampling x*cells/w with modulo lookups makes the
// field tile exactly at the canvas edges, which is what keeps repeated surfaces seam-free.
function noiseField(w, h, octaves, persistence, baseCells) {
  const out = new Float32Array(w * h)
  let amp = 1, total = 0, cells = baseCells || 4
  for (let o = 0; o < octaves; o++) {
    const g = new Float32Array(cells * cells)
    for (let i = 0; i < g.length; i++) g[i] = Math.random()
    const sx = cells / w, sy = cells / h
    for (let y = 0; y < h; y++) {
      const fy = y * sy, iy = Math.floor(fy), ty = smoothstep(fy - iy)
      const r0 = (iy % cells) * cells, r1 = ((iy + 1) % cells) * cells
      for (let x = 0; x < w; x++) {
        const fx = x * sx, ix = Math.floor(fx), tx = smoothstep(fx - ix)
        const c0 = ix % cells, c1 = (ix + 1) % cells
        const a = g[r0 + c0], b = g[r0 + c1], c = g[r1 + c0], d = g[r1 + c1]
        const top = a + (b - a) * tx, bot = c + (d - c) * tx
        out[y * w + x] += (top + (bot - top) * ty) * amp
      }
    }
    total += amp; amp *= persistence; cells *= 2
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

function softBlob(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(color, alpha)); g.addColorStop(0.6, rgba(color, alpha * 0.45)); g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

// Same blob repeated across the tile edges so soft mottling wraps instead of stopping at a seam.
function wrapBlob(ctx, W, H, x, y, r, color, alpha) {
  for (let dx = -W; dx <= W; dx += W) {
    for (let dy = -H; dy <= H; dy += H) {
      if (x + dx + r < 0 || x + dx - r > W || y + dy + r < 0 || y + dy - r > H) continue
      softBlob(ctx, x + dx, y + dy, r, color, alpha)
    }
  }
}

function strokePath(ctx, pts, style, width, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = style; ctx.lineWidth = width
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke(); ctx.restore()
}

// Per-pixel tooth: finer than any drawn speckle and the last thing every surface gets.
function pixelGrain(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    d[i] = clamp255(d[i] + n); d[i + 1] = clamp255(d[i + 1] + n); d[i + 2] = clamp255(d[i + 2] + n)
  }
  ctx.putImageData(img, 0, 0)
}

function speckle(ctx, w, h, count, color, aMin, aMax) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rgba(color, rand(aMin, aMax))
    ctx.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 1, 1)
  }
}

// Multiply a wrapping noise field into the canvas as a lightness swell of +/- (gain/2).
function modulate(ctx, w, h, field, gain) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data
  for (let i = 0, p = 0; i < field.length; i++, p += 4) {
    const k = 1 + (field[i] - 0.5) * gain
    d[p] = clamp255(d[p] * k); d[p + 1] = clamp255(d[p + 1] * k); d[p + 2] = clamp255(d[p + 2] * k)
  }
  ctx.putImageData(img, 0, 0)
}

/* ---------- 1. reusable noise ---------- */

export function valueNoise(w, h, opts = {}) {
  const { octaves = 4, persistence = 0.5, cells = 4 } = opts
  const f = noiseField(w, h, octaves, persistence, cells)
  const c = makeCanvas(w, h), x = c.getContext('2d')
  const img = x.createImageData(w, h), d = img.data
  for (let i = 0, p = 0; i < f.length; i++, p += 4) {
    d[p] = d[p + 1] = d[p + 2] = clamp255(f[i] * 255); d[p + 3] = 255
  }
  x.putImageData(img, 0, 0)
  return c
}

/* ---------- 2. painted plaster wall ---------- */

const plasterCache = new Map()
export function plasterWallTexture({ base = '#26456e' } = {}) {
  if (plasterCache.has(base)) return plasterCache.get(base)
  const W = 512, H = 512
  const c = makeCanvas(W, H), x = c.getContext('2d')
  const rgb = hexRgb(base)
  x.fillStyle = base; x.fillRect(0, 0, W, H)

  for (let i = 0; i < 44; i++) {
    const light = Math.random() < 0.5
    wrapBlob(x, W, H, Math.random() * W, Math.random() * H, rand(48, 150),
      light ? scaleRgb(rgb, 1.55) : scaleRgb(rgb, 0.55), rand(0.02, 0.05))
  }

  const lo = noiseField(W, H, 3, 0.55, 4)
  const hi = noiseField(W, H, 3, 0.5, 28)
  const streak = noiseField(W, 1, 3, 0.5, 7)
  const img = x.getImageData(0, 0, W, H), d = img.data
  for (let y = 0, p = 0; y < H; y++) {
    for (let xx = 0; xx < W; xx++, p += 4) {
      const i = y * W + xx
      const f = (1 + (lo[i] - 0.5) * 0.08) * (1 + (hi[i] - 0.5) * 0.055) * (1 + (streak[xx] - 0.5) * 0.035)
      const tooth = (Math.random() - 0.5) * 6
      d[p] = clamp255(d[p] * f + tooth); d[p + 1] = clamp255(d[p + 1] * f + tooth); d[p + 2] = clamp255(d[p + 2] * f + tooth)
    }
  }
  x.putImageData(img, 0, 0)

  // faint roller drag: long soft vertical bands, kept low contrast so tiling stays invisible
  for (let i = 0; i < 30; i++) {
    const sx = Math.random() * W, sw = rand(6, 26)
    const tint = Math.random() < 0.5 ? [255, 255, 255] : [0, 0, 0]
    x.fillStyle = grad(x, sx, 0, sx + sw, 0, [[0, rgba(tint, 0)], [0.5, rgba(tint, rand(0.012, 0.03))], [1, rgba(tint, 0)]])
    x.fillRect(sx, 0, sw, H)
  }

  speckle(x, W, H, 9000, [0, 0, 0], 0.02, 0.05)
  speckle(x, W, H, 4500, [255, 255, 255], 0.02, 0.05)

  // baked ceiling-corner shading: kept gentle so a vertical repeat reads as soft banding, not a seam
  x.fillStyle = grad(x, 0, 0, 0, H * 0.18, [[0, 'rgba(5,9,18,0.18)'], [1, 'rgba(5,9,18,0)']])
  x.fillRect(0, 0, W, H * 0.18)

  plasterCache.set(base, c)
  return c
}

/* ---------- 3. worn oak floor (colour + matching roughness) ---------- */

const FLOOR_HONEY = [182, 138, 84]
const FLOOR_BROWN = [112, 76, 45]

function drawPlank(cx, rx, x0, y0, y1, tone, PW) {
  const x1 = x0 + 1, w = PW - 3, h = y1 - y0
  cx.save(); cx.beginPath(); cx.rect(x1, y0, w, h); cx.clip()
  rx.save(); rx.beginPath(); rx.rect(x1, y0, w, h); rx.clip()
  cx.fillStyle = rgba(tone, 1); cx.fillRect(x1, y0, w, h)
  rx.fillStyle = '#8c8c8c'; rx.fillRect(x1, y0, w, h)

  for (let i = 0; i < 5; i++) {
    softBlob(cx, x1 + Math.random() * w, y0 + Math.random() * h, rand(28, 90),
      scaleRgb(tone, Math.random() < 0.5 ? 0.8 : 1.16), 0.16)
  }

  const n = 30 + ((Math.random() * 28) | 0)
  for (let g = 0; g < n; g++) {
    const gx = x1 + Math.random() * w, amp = rand(0.8, 5), ph = Math.random() * 6.28
    const pts = []
    for (let s = 0; s <= 6; s++) pts.push([gx + Math.sin(ph + s * 1.3) * amp, y0 - 4 + ((h + 8) * s) / 6])
    const dark = Math.random() < 0.72, lw = rand(0.6, 2.3)
    strokePath(cx, pts, rgba(scaleRgb(tone, dark ? rand(0.55, 0.84) : rand(1.1, 1.26)), 1), lw,
      dark ? rand(0.2, 0.5) : rand(0.08, 0.22))
    if (dark && Math.random() < 0.55) strokePath(rx, pts, '#ffffff', lw, rand(0.05, 0.15))
  }

  if (Math.random() < 0.45) {
    const ax = x1 + rand(0.25, 0.75) * w, ay = y0 + rand(0.1, 0.9) * h, ah = rand(60, 170)
    for (let k = 0; k < 3; k++) {
      const spread = 4 + k * 4.5
      cx.strokeStyle = rgba(scaleRgb(tone, 0.64), 0.2); cx.lineWidth = 1 + Math.random()
      cx.beginPath(); cx.moveTo(ax - spread, ay + ah)
      cx.quadraticCurveTo(ax, ay - ah * 0.35, ax + spread, ay + ah); cx.stroke()
    }
  }

  if (Math.random() < 0.18) {
    const kx = x1 + rand(0.2, 0.8) * w, ky = y0 + rand(0.15, 0.85) * h, kr = rand(3.5, 8)
    for (let r = kr; r > 0.8; r *= 0.62) {
      cx.strokeStyle = rgba(scaleRgb(tone, 0.42), 0.5); cx.lineWidth = 1.1
      cx.beginPath(); cx.ellipse(kx, ky, r * 0.68, r, rand(-0.3, 0.3), 0, Math.PI * 2); cx.stroke()
    }
    cx.fillStyle = rgba(scaleRgb(tone, 0.28), 0.85)
    cx.beginPath(); cx.ellipse(kx, ky, 1.7, 2.5, 0, 0, Math.PI * 2); cx.fill()
    softBlob(rx, kx, ky, kr * 1.7, [255, 255, 255], 0.8)
  }

  cx.restore(); rx.restore()
}

let floorPair = null
function buildFloor() {
  if (floorPair) return floorPair
  const S = 1024, PW = 128
  const col = makeCanvas(S, S), cx = col.getContext('2d')
  const rgh = makeCanvas(S, S), rx = rgh.getContext('2d')
  cx.fillStyle = '#33220f'; cx.fillRect(0, 0, S, S)
  rx.fillStyle = '#e6e6e6'; rx.fillRect(0, 0, S, S)

  for (let i = 0; i < S / PW; i++) {
    const x0 = i * PW
    const cuts = []
    for (let y = rand(140, 430); y < S - 140; y += rand(270, 620)) cuts.push(y)
    const bounds = [0].concat(cuts, [S])
    const boards = []
    for (let b = 0; b < bounds.length - 1; b++) {
      boards.push({ y0: bounds[b], y1: bounds[b + 1], tone: scaleRgb(mixRgb(FLOOR_HONEY, FLOOR_BROWN, Math.random()), rand(0.94, 1.07)) })
    }
    // the board crossing the tile seam is one plank: give the top piece the bottom piece's tone
    if (boards.length > 1) boards[0].tone = boards[boards.length - 1].tone
    for (const b of boards) drawPlank(cx, rx, x0, b.y0, b.y1, b.tone, PW)

    for (const cy of cuts) {
      cx.fillStyle = 'rgba(26,16,8,0.72)'; cx.fillRect(x0 + 1, cy - 1, PW - 3, 2)
      cx.fillStyle = 'rgba(255,228,186,0.10)'; cx.fillRect(x0 + 1, cy + 1, PW - 3, 1)
      rx.fillStyle = 'rgba(238,238,238,0.85)'; rx.fillRect(x0 + 1, cy - 1, PW - 3, 3)
    }

    cx.fillStyle = grad(cx, x0, 0, x0 + 16, 0, [[0, 'rgba(28,17,8,0.3)'], [1, 'rgba(28,17,8,0)']])
    cx.fillRect(x0, 0, 16, S)
    cx.fillStyle = grad(cx, x0 + PW, 0, x0 + PW - 16, 0, [[0, 'rgba(28,17,8,0.24)'], [1, 'rgba(28,17,8,0)']])
    cx.fillRect(x0 + PW - 16, 0, 16, S)
  }

  // plank gaps: 2px dark shadow with a single warm lip highlight on the right edge
  for (let i = 0; i <= S / PW; i++) {
    const x0 = i * PW
    cx.fillStyle = 'rgba(22,13,6,0.9)'; cx.fillRect(x0 - 1, 0, 2, S)
    cx.fillStyle = 'rgba(255,226,180,0.13)'; cx.fillRect(x0 + 1, 0, 1, S)
    rx.fillStyle = 'rgba(242,242,242,0.9)'; rx.fillRect(x0 - 1, 0, 2, S)
  }

  // traffic wear: colour gets a sheen, roughness gets smoother at the very same spots
  for (let i = 0; i < 15; i++) {
    const lane = i % 2 === 0
    const px = lane ? S * 0.5 + rand(-150, 150) : rand(0, S)
    const py = rand(0, S), pr = rand(80, 210)
    wrapBlob(cx, S, S, px, py, pr, [255, 238, 208], rand(0.045, 0.095))
    wrapBlob(rx, S, S, px, py, pr, [50, 50, 50], rand(0.3, 0.5))
  }

  speckle(cx, S, S, 26000, [30, 18, 8], 0.03, 0.07)
  speckle(cx, S, S, 9000, [255, 240, 215], 0.02, 0.05)
  pixelGrain(cx, S, S, 11)
  pixelGrain(rx, S, S, 16)

  floorPair = { color: col, rough: rgh }
  return floorPair
}

export function floorPlankTexture() { return buildFloor().color }
export function floorRoughnessTexture() { return buildFloor().rough }

/* ---------- 4. dark walnut shelving (colour + matching roughness) ---------- */

let shelfPair = null
function buildShelf() {
  if (shelfPair) return shelfPair
  const S = 512
  const col = makeCanvas(S, S), cx = col.getContext('2d')
  const rgh = makeCanvas(S, S), rx = rgh.getContext('2d')
  const DARK = [46, 29, 18], MID = [96, 63, 40]
  cx.fillStyle = rgba(mixRgb(DARK, MID, 0.55), 1); cx.fillRect(0, 0, S, S)
  rx.fillStyle = '#595959'; rx.fillRect(0, 0, S, S)   // 0.35 roughness

  for (let i = 0; i < 14; i++) {
    const bx = Math.random() * S, bw = rand(30, 110)
    const tone = Math.random() < 0.5 ? scaleRgb(DARK, rand(0.7, 1.1)) : scaleRgb(MID, rand(1.0, 1.25))
    cx.fillStyle = grad(cx, bx, 0, bx + bw, 0, [[0, rgba(tone, 0)], [0.5, rgba(tone, rand(0.18, 0.34))], [1, rgba(tone, 0)]])
    cx.fillRect(bx - S, 0, bw, S); cx.fillRect(bx, 0, bw, S)
  }

  for (let g = 0; g < 260; g++) {
    const gx = Math.random() * S, amp = rand(0.5, 3.5), ph = Math.random() * 6.28
    const pts = []
    for (let s = 0; s <= 8; s++) pts.push([gx + Math.sin(ph + s * 0.9) * amp, -4 + ((S + 8) * s) / 8])
    const dark = Math.random() < 0.75, lw = rand(0.5, 2.6)
    const tone = dark ? scaleRgb(DARK, rand(0.45, 0.95)) : scaleRgb(MID, rand(1.15, 1.4))
    strokePath(cx, pts, rgba(tone, 1), lw, dark ? rand(0.18, 0.46) : rand(0.07, 0.18))
    if (dark && Math.random() < 0.5) strokePath(rx, pts, '#ffffff', lw, rand(0.05, 0.13))
  }

  // cathedral figure: nested arcs that come to a point, the way flat-sawn walnut reads
  for (let a = 0; a < 9; a++) {
    const ax = Math.random() * S, ay = rand(-40, S), ah = rand(90, 240)
    for (let k = 0; k < 4; k++) {
      const spread = 3 + k * 4
      cx.strokeStyle = rgba(scaleRgb(DARK, 0.55), 0.16); cx.lineWidth = 0.8 + Math.random()
      cx.beginPath(); cx.moveTo(ax - spread, ay + ah)
      cx.quadraticCurveTo(ax, ay - ah * 0.4, ax + spread, ay + ah); cx.stroke()
    }
  }

  // varnish: broad soft vertical sheen bands (smoother in the roughness map at the same x)
  for (let i = 0; i < 5; i++) {
    const sx = Math.random() * S, sw = rand(50, 150)
    cx.fillStyle = grad(cx, sx, 0, sx + sw, 0,
      [[0, 'rgba(255,226,182,0)'], [0.5, `rgba(255,226,182,${rand(0.04, 0.085)})`], [1, 'rgba(255,226,182,0)']])
    cx.fillRect(sx - S, 0, sw, S); cx.fillRect(sx, 0, sw, S)
    rx.fillStyle = grad(rx, sx, 0, sx + sw, 0, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,0)']])
    rx.fillRect(sx - S, 0, sw, S); rx.fillRect(sx, 0, sw, S)
  }

  speckle(cx, S, S, 11000, [18, 10, 4], 0.03, 0.07)
  pixelGrain(cx, S, S, 9)
  pixelGrain(rx, S, S, 10)

  shelfPair = { color: col, rough: rgh }
  return shelfPair
}

export function shelfWoodTexture() { return buildShelf().color }
export function shelfWoodRoughnessTexture() { return buildShelf().rough }

/* ---------- 5. leather & fabric ---------- */

const leatherCache = new Map()
export function leatherTexture({ base = '#7a4a2e' } = {}) {
  if (leatherCache.has(base)) return leatherCache.get(base)
  const S = 512
  const c = makeCanvas(S, S), x = c.getContext('2d')
  const rgb = hexRgb(base)
  x.fillStyle = base; x.fillRect(0, 0, S, S)

  for (let i = 0; i < 30; i++) {
    wrapBlob(x, S, S, Math.random() * S, Math.random() * S, rand(50, 160),
      Math.random() < 0.5 ? scaleRgb(rgb, 1.45) : scaleRgb(rgb, 0.6), rand(0.025, 0.06))
  }

  // pebble grain: thousands of overlapping cell rims, each with a shadowed rim and a lit upper edge
  const dk = scaleRgb(rgb, 0.42), lt = scaleRgb(rgb, 1.65)
  for (let i = 0; i < 5400; i++) {
    const px = Math.random() * S, py = Math.random() * S, r = rand(1.1, 3.6), rot = Math.random() * 6.28
    x.strokeStyle = rgba(dk, rand(0.08, 0.2)); x.lineWidth = rand(0.7, 1.5)
    x.beginPath(); x.arc(px, py, r, rot, rot + rand(2.4, 5.8)); x.stroke()
    if (Math.random() < 0.65) {
      x.strokeStyle = rgba(lt, rand(0.05, 0.12))
      x.beginPath(); x.arc(px - 0.7, py - 0.8, r * 0.8, rot + 3.1, rot + 4.7); x.stroke()
    }
  }
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = rgba(dk, rand(0.05, 0.14))
    x.beginPath(); x.arc(Math.random() * S, Math.random() * S, rand(0.5, 1.4), 0, Math.PI * 2); x.fill()
  }

  modulate(x, S, S, noiseField(S, S, 3, 0.5, 40), 0.09)   // hide depth under the pebbles

  for (let i = 0; i < 12; i++) {
    wrapBlob(x, S, S, Math.random() * S, Math.random() * S, rand(40, 120), [255, 232, 200], rand(0.05, 0.11))
  }

  for (let i = 0; i < 14; i++) {                          // creases
    const sx = Math.random() * S, sy = Math.random() * S
    x.strokeStyle = rgba(dk, rand(0.06, 0.14)); x.lineWidth = rand(0.8, 2)
    x.beginPath(); x.moveTo(sx, sy)
    x.quadraticCurveTo(sx + rand(-90, 90), sy + rand(-90, 90), sx + rand(-160, 160), sy + rand(-160, 160))
    x.stroke()
  }

  const vig = x.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.74)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(20,10,4,0.3)')
  x.fillStyle = vig; x.fillRect(0, 0, S, S)

  speckle(x, S, S, 12000, [0, 0, 0], 0.03, 0.06)
  pixelGrain(x, S, S, 8)
  leatherCache.set(base, c)
  return c
}

const fabricCache = new Map()
export function fabricTexture({ base = '#0f2d63' } = {}) {
  if (fabricCache.has(base)) return fabricCache.get(base)
  const S = 256, CELL = 4
  const c = makeCanvas(S, S), x = c.getContext('2d')
  const rgb = hexRgb(base)
  x.fillStyle = rgba(scaleRgb(rgb, 0.82), 1)
  x.fillRect(0, 0, S, S)

  for (let gy = 0; gy < S / CELL; gy++) {
    for (let gx = 0; gx < S / CELL; gx++) {
      const px = gx * CELL, py = gy * CELL
      const jitter = 1 + (Math.random() - 0.5) * 0.06
      const warp = (gx + gy) % 2 === 0
      // one thread per cell, run across or down; warp and weft alternate like a plain weave
      const put = (off, thick) => (warp ? x.fillRect(px, py + off, CELL, thick) : x.fillRect(px + off, py, thick, CELL))
      x.fillStyle = rgba(scaleRgb(rgb, jitter * (warp ? 1.1 : 0.94)), 1); put(0.5, CELL - 1)
      x.fillStyle = rgba(scaleRgb(rgb, 1.5), 0.1); put(0.5, 1)
      x.fillStyle = 'rgba(0,0,0,0.12)'; put(CELL - 1.5, 1)
    }
  }

  for (let i = 0; i < 14; i++) {
    wrapBlob(x, S, S, Math.random() * S, Math.random() * S, rand(30, 80),
      Math.random() < 0.5 ? scaleRgb(rgb, 1.4) : [0, 0, 0], rand(0.02, 0.045))
  }
  speckle(x, S, S, 5000, [0, 0, 0], 0.03, 0.06)
  pixelGrain(x, S, S, 7)
  fabricCache.set(base, c)
  return c
}

/* ---------- 6. packed row of book spines ---------- */

const SPINE_NEUTRALS = ['#6b5a45', '#4a4438', '#2e3a44', '#5c4a3a', '#3d4a3f', '#6e6455', '#403a4a', '#7a6a52', '#332c26', '#57443a']
const SPINE_ACCENTS = ['#0b4bad', '#c96a2e', '#2f6b4f', '#8a3033', '#5b4a8f']
const FOILS = [[217, 190, 122], [232, 220, 192], [198, 164, 96]]

function drawOneSpine(x, w, h, lean) {
  // drawn in local space: (0,0) is the spine's bottom-left, growing upward
  const base = hexRgb(Math.random() < 0.24 ? pick(SPINE_ACCENTS) : pick(SPINE_NEUTRALS))
  const body = scaleRgb(base, rand(0.86, 1.16))
  x.fillStyle = grad(x, 0, 0, w, 0, [
    [0, rgba(scaleRgb(body, 0.52), 1)], [0.18, rgba(scaleRgb(body, 0.92), 1)], [0.48, rgba(scaleRgb(body, 1.12), 1)],
    [0.82, rgba(scaleRgb(body, 0.9), 1)], [1, rgba(scaleRgb(body, 0.6), 1)]])
  x.fillRect(0, -h, w, h)
  x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, -h, 1, h)
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(w - 1, -h, 1, h)

  // cloth tooth + a slightly lit head
  for (let i = 0; i < 90; i++) {
    x.fillStyle = Math.random() < 0.6 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'
    x.fillRect(Math.random() * w, -h + Math.random() * h, 1, rand(1, 6))
  }
  x.fillStyle = 'rgba(255,238,208,0.16)'; x.fillRect(1, -h, w - 2, 1.5)
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, -h, w, 1)

  const foil = FOILS[(Math.random() * FOILS.length) | 0]
  const bands = 1 + ((Math.random() * 3) | 0)
  const nearTop = Math.random() < 0.55
  let by = nearTop ? -h + rand(16, 34) : -rand(20, 48)
  for (let b = 0; b < bands; b++) {
    x.fillStyle = rgba(foil, rand(0.55, 0.9))
    x.fillRect(3, by, Math.max(2, w - 6), Math.random() < 0.3 ? 2 : 1)
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(3, by + 1.5, Math.max(2, w - 6), 1)
    by += rand(4, 11)
  }

  if (Math.random() < 0.45 && w > 22) {                   // blank title block
    const bh = rand(38, 74), bw = w - 9
    const ty = -h + rand(46, Math.max(60, h - bh - 40))
    x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.22)' : rgba(scaleRgb(body, 1.3), 0.28)
    x.fillRect(4.5, ty, bw, bh)
    x.strokeStyle = rgba(foil, 0.4); x.lineWidth = 1; x.strokeRect(4.5, ty, bw, bh)
  }

  x.fillStyle = 'rgba(255,240,215,0.10)'; x.fillRect(1, -h, w - 2, rand(2, 5))   // worn head
  x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(1, -rand(2, 5), w - 2, rand(2, 5)) // scuffed foot
  if (lean) { x.fillStyle = 'rgba(255,236,205,0.08)'; x.fillRect(1, -h, w - 2, h) }
}

let spineRow = null
export function spineRowTexture() {
  if (spineRow) return spineRow
  const W = 1024, H = 256
  const c = makeCanvas(W, H), x = c.getContext('2d')
  x.fillStyle = '#191008'; x.fillRect(0, 0, W, H)         // case interior shadow
  for (let i = 0; i < 18; i++) {
    wrapBlob(x, W, H, Math.random() * W, Math.random() * H * 0.6, rand(40, 130), [60, 38, 20], 0.1)
  }

  let px = 0, count = 0
  while (px < W) {
    if (Math.random() < 0.12) { px += rand(3, 7); continue }        // dark gap between clusters
    const w = rand(18, 44), h = H * rand(0.75, 0.98)
    const lean = count > 0 && count % 10 === 9 && px + w + 14 < W
    x.save()
    x.translate(px, H)                                    // pivot at the spine's foot on the shelf
    if (lean) x.rotate(rand(0.07, 0.15) * (Math.random() < 0.5 ? -1 : 1))
    drawOneSpine(x, w, h, lean)
    x.restore()
    px += lean ? w + rand(4, 10) : w + rand(0, 1.2)
    count++
  }

  x.fillStyle = grad(x, 0, 0, 0, H * 0.42, [[0, 'rgba(18,11,5,0.62)'], [1, 'rgba(18,11,5,0)']])
  x.fillRect(0, 0, W, H * 0.42)
  x.fillStyle = grad(x, 0, H - 8, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']])
  x.fillRect(0, H - 8, W, 8)

  speckle(x, W, H, 9000, [0, 0, 0], 0.03, 0.06)
  pixelGrain(x, W, H, 8)
  spineRow = c
  return c
}

/* ---------- 7 & 8. ceiling plaster and brass ---------- */

let ceilingTex = null
export function ceilingTexture() {
  if (ceilingTex) return ceilingTex
  const S = 512
  const c = makeCanvas(S, S), x = c.getContext('2d')
  x.fillStyle = '#efe6d5'; x.fillRect(0, 0, S, S)
  for (let i = 0; i < 26; i++) {
    wrapBlob(x, S, S, Math.random() * S, Math.random() * S, rand(70, 190),
      Math.random() < 0.5 ? [255, 252, 244] : [176, 164, 142], rand(0.02, 0.045))
  }
  modulate(x, S, S, noiseField(S, S, 3, 0.5, 8), 0.05)
  speckle(x, S, S, 7000, [120, 108, 88], 0.02, 0.04)
  pixelGrain(x, S, S, 5)
  ceilingTex = c
  return c
}

let brassTex = null
export function brassTexture() {
  if (brassTex) return brassTex
  const S = 128
  const c = makeCanvas(S, S), x = c.getContext('2d')
  x.fillStyle = grad(x, 0, 0, S, 0,
    [[0, '#7d5e21'], [0.32, '#d8b25c'], [0.55, '#f0dca0'], [0.78, '#b98f38'], [1, '#6d5019']])
  x.fillRect(0, 0, S, S)
  for (let i = 0; i < 260; i++) {                         // polish streaks
    x.fillStyle = Math.random() < 0.5 ? `rgba(255,244,206,${rand(0.03, 0.12)})` : `rgba(70,48,10,${rand(0.03, 0.12)})`
    x.fillRect(Math.random() * S, -2, rand(0.5, 2.2), S + 4)
  }
  for (let i = 0; i < 6; i++) {
    wrapBlob(x, S, S, Math.random() * S, Math.random() * S, rand(18, 48), [90, 64, 18], rand(0.04, 0.09))
  }
  speckle(x, S, S, 2600, [60, 40, 8], 0.03, 0.07)
  pixelGrain(x, S, S, 6)
  brassTex = c
  return c
}
