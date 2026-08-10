// Furniture props for the VFO Library: lathed pedestals, rolled arms, curved backs, alpha-cut
// leaves — not stacked boxes. Each builder returns a THREE.Group, origin on the floor (y=0), in
// metres, carrying its own baked contact shadow (no shadow mapping here: the blob IS the shadow).
import * as THREE from 'three'
import { valueNoise, leatherTexture, fabricTexture, brassTexture, shelfWoodTexture } from './textures.js'

const TAU = Math.PI * 2
const canvas2d = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

// Deterministic jitter so a rebuilt prop looks identical between reloads.
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function tex(canvas, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.anisotropy = 4
  return t
}

/* ---------- shared textures & materials (built once, on first prop) ---------- */

let T = null
function textures() {
  if (T) return T
  // Mid-grey-biased noise: as a roughnessMap it must not swing the whole 0..1 range or
  // the upholstery goes blotchy, so flatten its contrast toward white before upload.
  const raw = valueNoise(256, 256, { octaves: 4, persistence: 0.55, cells: 14 })
  const soft = canvas2d(256, 256), sx = soft.getContext('2d')
  sx.drawImage(raw, 0, 0)
  sx.fillStyle = 'rgba(255,255,255,0.55)'
  sx.fillRect(0, 0, 256, 256)
  T = {
    hide: tex(leatherTexture({ base: '#6f4429' }), 2, 2),
    hideWrap: tex(leatherTexture({ base: '#6f4429' }), 3, 2),
    navy: tex(fabricTexture({ base: '#16305e' }), 5, 5),
    brass: tex(brassTexture(), 1, 1),
    wood: tex(shelfWoodTexture(), 1, 2),
    woodFine: tex(shelfWoodTexture(), 2, 2),
    rough: tex(soft, 3, 3, false),
    glaze: tex(potGlaze(raw), 1, 1),
  }
  return T
}

let M = null
function mats() {
  if (M) return M
  const t = textures()
  const warm = new THREE.Color().setRGB(1.3, 1.08, 0.9)   // >1 lifts the dark walnut map to a warmer oak
  M = {
    leather: new THREE.MeshStandardMaterial({ map: t.hide, roughnessMap: t.rough, roughness: 0.65, metalness: 0.05 }),
    leatherDeep: new THREE.MeshStandardMaterial({ map: t.hide, roughnessMap: t.rough, color: '#b4a89f', roughness: 0.7, metalness: 0.05 }),
    leatherShell: new THREE.MeshStandardMaterial({ map: t.hideWrap, roughnessMap: t.rough, color: '#c8bcb2', roughness: 0.68, metalness: 0.05, side: THREE.DoubleSide }),
    fabric: new THREE.MeshStandardMaterial({ map: t.navy, roughness: 0.92, metalness: 0 }),
    fabricDeep: new THREE.MeshStandardMaterial({ map: t.navy, color: '#8d97ad', roughness: 0.95, metalness: 0 }),
    brass: new THREE.MeshStandardMaterial({ map: t.brass, metalness: 0.85, roughness: 0.3 }),
    brassDim: new THREE.MeshStandardMaterial({ map: t.brass, color: '#a89066', metalness: 0.8, roughness: 0.45 }),
    woodDark: new THREE.MeshStandardMaterial({ map: t.wood, roughnessMap: t.rough, roughness: 0.45, metalness: 0.04 }),
    woodWarm: new THREE.MeshStandardMaterial({ map: t.woodFine, roughnessMap: t.rough, color: warm, roughness: 0.4, metalness: 0.04 }),
    shade: new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.85, metalness: 0, side: THREE.DoubleSide, emissive: '#3f2f14', emissiveIntensity: 1 }),
    bulb: new THREE.MeshBasicMaterial({ color: '#ffe9b8' }),
    pot: new THREE.MeshStandardMaterial({ map: t.glaze, roughness: 0.25, metalness: 0.05 }),
    soil: new THREE.MeshStandardMaterial({ color: '#2b2117', roughness: 1 }),
    stem: new THREE.MeshStandardMaterial({ color: '#41682f', roughness: 0.8 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.85, metalness: 0.1 }),
  }
  return M
}

/* ---------- geometry helpers ---------- */

// Plan-view rounded rectangle: x = width, y = depth (the extrude runs along +Z, later up).
function roundedRect(w, d, r) {
  const s = new THREE.Shape(), hw = w / 2, hd = d / 2
  s.moveTo(-hw + r, -hd)
  s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r)
  s.lineTo(hw, hd - r); s.quadraticCurveTo(hw, hd, hw - r, hd)
  s.lineTo(-hw + r, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r)
  s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd)
  return s
}

// Upholstered slab: bevelled extrude, so every edge is a soft roll rather than a hard box
// corner. The bevel bulges the waist out by `bt`, hence the inset shape.
function puff(w, d, h, r, mat, bt = 0.022) {
  const shape = roundedRect(Math.max(0.02, w - bt * 2), Math.max(0.02, d - bt * 2), Math.max(0.012, r - bt))
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, h - bt * 2), bevelEnabled: true, bevelThickness: bt, bevelSize: bt,
    bevelSegments: 2, curveSegments: 3, steps: 1,
  })
  geo.rotateX(-Math.PI / 2)   // shape plane XY -> XZ, extrusion +Z -> up
  geo.translate(0, bt, 0)     // bevel starts at -bt: lift so the base sits on y = 0
  return new THREE.Mesh(geo, mat)
}

// Torus arc lying flat in XZ, centred on the -Z axis (chair-back top rolls).
function arcTorus(R, tube, arc, rad = 6, tub = 14) {
  const g = new THREE.TorusGeometry(R, tube, rad, tub, arc)
  g.rotateZ(Math.PI / 2 - arc / 2)   // centre the arc on the ring's +Y
  g.rotateX(-Math.PI / 2)            // +Y -> -Z, ring lies flat
  return g
}

const lathe = (pts, seg, scale = 1) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * scale, y * scale)), seg)

// Bow a slab along its width so it hugs a curved back (+k pushes the ends toward +Z).
function curveByX(geo, k) {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + k * p.getX(i) * p.getX(i))
  p.needsUpdate = true
}

// Crown the top face of a cushion. Normals are deliberately left alone: a 15 mm rise reads
// as a dome under the env map, and recomputing would flat-shade the bevel.
function domeTop(geo, topY, amount, halfW) {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (y < topY - 0.02) continue
    const r = Math.min(1, Math.hypot(p.getX(i), p.getZ(i)) / halfW)
    p.setY(i, y + amount * Math.cos(r * Math.PI / 2))
  }
  p.needsUpdate = true
}

/* ---------- 1. contact shadow ---------- */

const shadowCache = new Map()
export function contactShadow(w, d, opacity = 0.5) {
  const key = opacity.toFixed(3)
  let mat = shadowCache.get(key)
  if (!mat) {
    const c = canvas2d(128, 128), x = c.getContext('2d')
    x.translate(64, 64); x.scale(1, 0.92); x.translate(-64, -64)   // squashed ellipse
    // Hold near-full density across the footprint, then fall away — a tight radial ramp
    // reads as a dot under the furniture instead of a shadow.
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, `rgba(0,0,0,${opacity})`)
    g.addColorStop(0.34, `rgba(0,0,0,${opacity * 0.88})`)
    g.addColorStop(0.58, `rgba(0,0,0,${opacity * 0.52})`)
    g.addColorStop(0.80, `rgba(0,0,0,${opacity * 0.17})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g
    x.fillRect(-32, -32, 208, 208)
    mat = new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false })
    shadowCache.set(key, mat)
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat)
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.004
  m.renderOrder = 1
  return m
}

/* ---------- 2. club armchair (faces +Z) ---------- */

export function buildArmchair() {
  const g = new THREE.Group(); g.name = 'armchair'
  const m = mats()

  // turned bun feet
  const footGeo = lathe([[0.012, 0], [0.030, 0.006], [0.045, 0.030], [0.042, 0.056], [0.026, 0.078], [0.020, 0.09]], 8)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = new THREE.Mesh(footGeo, m.woodDark)
    f.position.set(sx * 0.29, 0, sz * 0.30)
    g.add(f)
  }

  // apron + seat
  const apron = puff(0.74, 0.78, 0.23, 0.07, m.leatherDeep)
  apron.position.y = 0.09
  const frontRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.70, 12), m.leather)
  frontRoll.rotation.z = Math.PI / 2          // cylinder axis Y -> X
  frontRoll.scale.set(0.72, 1, 1)             // squash the vertical of the cross-section
  frontRoll.position.set(0, 0.30, 0.345)
  const seat = puff(0.54, 0.60, 0.13, 0.06, m.fabric, 0.034)   // fatter bevel = pillow edge
  domeTop(seat.geometry, 0.13, 0.017, 0.27)
  seat.position.y = 0.31
  const welt = puff(0.556, 0.616, 0.014, 0.06, m.fabricDeep, 0.006)   // piped seam around the cushion
  welt.position.y = 0.362
  g.add(apron, frontRoll, seat, welt)

  // rolled arms: side panel + horizontal roll + scroll ring on the front face
  const panel = puff(0.11, 0.72, 0.26, 0.045, m.leather)
  const rollGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.74, 14)
  rollGeo.rotateX(Math.PI / 2)                 // axis Y -> Z, running front-to-back
  const scrollGeo = new THREE.TorusGeometry(0.048, 0.011, 6, 16)   // already ringed around Z
  const trimGeo = new THREE.BoxGeometry(0.012, 0.23, 0.012)
  for (const s of [-1, 1]) {
    const p = s < 0 ? panel : panel.clone()
    p.position.set(s * 0.33, 0.32, 0.02)
    const roll = new THREE.Mesh(rollGeo, m.leather)
    roll.position.set(s * 0.33, 0.615, 0.02)
    const scroll = new THREE.Mesh(scrollGeo, m.brassDim)
    scroll.position.set(s * 0.33, 0.615, 0.392)
    const trim = new THREE.Mesh(trimGeo, m.brassDim)   // nailhead hint down the arm front
    trim.position.set(s * 0.33, 0.45, 0.386)
    g.add(p, roll, scroll, trim)
  }
  const skirtTrim = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.012, 0.012), m.brassDim)
  skirtTrim.position.set(0, 0.145, 0.392)
  g.add(skirtTrim)

  // Curved back: a partial cylinder wrapping the sitter, flared wider at the top for the
  // wing hint. Whole assembly lives in a group pivoted at the seat joint so it leans back.
  const back = new THREE.Group()
  back.position.set(0, 0.34, 0.26)
  back.rotation.x = -0.10
  const HALF = 0.60
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.60, 0.56, 0.68, 20, 1, true, Math.PI - HALF, HALF * 2),
    m.leatherShell,
  )
  shell.position.y = 0.35
  const topRoll = new THREE.Mesh(arcTorus(0.585, 0.045, HALF * 2 + 0.04), m.leather)
  topRoll.position.y = 0.70
  const cushion = puff(0.60, 0.17, 0.46, 0.07, m.fabric, 0.038)
  curveByX(cushion.geometry, 0.8)              // match the shell's sweep
  cushion.position.set(0, 0.06, -0.46)
  back.add(shell, topRoll, cushion)
  g.add(back)

  g.add(contactShadow(1.0, 1.0, 0.45))
  return g
}

/* ---------- 3. round pedestal side table ---------- */

export function buildSideTable() {
  const g = new THREE.Group(); g.name = 'sideTable'
  const m = mats()

  const feetGeo = lathe([[0.006, 0], [0.026, 0.004], [0.028, 0.012], [0.018, 0.017]], 8)
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 + 0.4
    const f = new THREE.Mesh(feetGeo, m.woodWarm)
    f.position.set(Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11)
    g.add(f)
  }
  const base = new THREE.Mesh(
    lathe([[0, 0.016], [0.148, 0.016], [0.152, 0.032], [0.115, 0.056], [0.072, 0.070], [0.060, 0.095]], 16),
    m.woodWarm,
  )
  // turned column: three bulges up a tapered shaft, flaring into the top's underside
  const column = new THREE.Mesh(lathe([
    [0.090, 0.090], [0.062, 0.108], [0.050, 0.135], [0.072, 0.168], [0.078, 0.186], [0.048, 0.216],
    [0.036, 0.280], [0.033, 0.340], [0.058, 0.372], [0.062, 0.392], [0.040, 0.424], [0.034, 0.470],
    [0.052, 0.496], [0.196, 0.503],
  ], 16), m.woodWarm)
  const under = new THREE.Mesh(new THREE.CylinderGeometry(0.196, 0.196, 0.018, 24), m.woodWarm)
  under.position.y = 0.512
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.028, 24), m.woodWarm)
  top.position.y = 0.535
  g.add(base, column, under, top, contactShadow(0.52, 0.52, 0.4))
  return g
}

/* ---------- 4. brass floor lamp ---------- */

export function buildFloorLamp() {
  const g = new THREE.Group(); g.name = 'floorLamp'
  const m = mats()

  const base = new THREE.Mesh(
    lathe([[0, 0], [0.130, 0], [0.138, 0.018], [0.104, 0.036], [0.058, 0.046], [0.050, 0.062]], 20),
    m.brassDim,
  )
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.018, 1.36, 10), m.brass)
  pole.position.y = 0.05 + 1.36 / 2
  const collar = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 6), m.brass)
  collar.position.y = 1.40
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.26, 20, 1, true), m.shade)
  shade.position.y = 1.46
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 4, 16), m.brass)
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 1.59
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6), m.bulb)
  bulb.position.y = 1.45

  const light = new THREE.PointLight('#ffd9a0', 3.5, 3.2, 2)
  light.position.y = 1.45
  g.add(base, pole, collar, shade, rim, bulb, light, contactShadow(0.42, 0.42, 0.4))
  return g
}

/* ---------- 5. potted plant ---------- */

function potGlaze(noise) {
  const c = canvas2d(128, 128), x = c.getContext('2d')
  // Lathe v runs bottom -> top of the profile, and canvas row 0 lands at v=1: rim on top.
  const g = x.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, '#e9e2d0'); g.addColorStop(0.34, '#d3d5c1')
  g.addColorStop(0.60, '#93a691'); g.addColorStop(1, '#5d7268')
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  const r = rng(7)
  x.globalAlpha = 0.30                                   // glaze drips over the tone break
  for (let i = 0; i < 16; i++) {
    const px = r() * 128, len = 8 + r() * 26
    x.fillStyle = r() < 0.5 ? '#e6e1cf' : '#7f9385'
    x.beginPath(); x.ellipse(px, 62 + len / 2, 2.4 + r() * 2.6, len / 2, 0, 0, TAU); x.fill()
  }
  x.globalAlpha = 0.12
  x.globalCompositeOperation = 'multiply'
  x.drawImage(noise, 0, 0, 128, 128)
  x.globalCompositeOperation = 'source-over'
  x.globalAlpha = 0.16                                   // sheen band
  const sh = x.createLinearGradient(24, 0, 60, 0)
  sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, '#ffffff'); sh.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = sh; x.fillRect(24, 0, 36, 128)
  x.globalAlpha = 1
  return c
}

// One leaf, drawn tip-up with the petiole at the bottom edge so the plane's +Y is the stem axis.
function leafCanvas(kind, hue) {
  const W = 160, H = 200, cx = W / 2
  const c = canvas2d(W, H), x = c.getContext('2d')
  const grad = x.createLinearGradient(0, H, 0, 0)
  grad.addColorStop(0, `hsl(${hue - 8},44%,22%)`)
  grad.addColorStop(0.55, `hsl(${hue},41%,34%)`)
  grad.addColorStop(1, `hsl(${hue + 4},44%,47%)`)
  x.fillStyle = grad

  if (kind === 'fern') {
    const n = 15
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), y = H * (0.93 - t * 0.86)
      const len = W * 0.46 * Math.sin(Math.PI * (0.16 + t * 0.74))
      for (const s of [-1, 1]) {
        x.save(); x.translate(cx, y); x.rotate(s * -0.34)
        x.beginPath(); x.ellipse(s * len / 2, 0, len / 2, H * 0.026, 0, 0, TAU); x.fill()
        x.globalCompositeOperation = 'destination-out'   // serrate the trailing edge
        for (let k = 0; k < 4; k++) {
          x.beginPath(); x.arc(s * len * (0.25 + k * 0.2), H * 0.022, H * 0.013, 0, TAU); x.fill()
        }
        x.globalCompositeOperation = 'source-over'
        x.restore()
      }
    }
    x.strokeStyle = `hsl(${hue - 12},40%,30%)`; x.lineWidth = 4
    x.beginPath(); x.moveTo(cx, H * 0.99); x.lineTo(cx, H * 0.05); x.stroke()
  } else {
    x.beginPath()                                        // broad heart-shaped blade
    x.moveTo(cx, H * 0.99)
    x.bezierCurveTo(cx - W * 0.06, H * 0.87, cx - W * 0.44, H * 0.80, cx - W * 0.46, H * 0.50)
    x.bezierCurveTo(cx - W * 0.47, H * 0.24, cx - W * 0.22, H * 0.06, cx, H * 0.035)
    x.bezierCurveTo(cx + W * 0.22, H * 0.06, cx + W * 0.47, H * 0.24, cx + W * 0.46, H * 0.50)
    x.bezierCurveTo(cx + W * 0.44, H * 0.80, cx + W * 0.06, H * 0.87, cx, H * 0.99)
    x.closePath(); x.fill()
    x.globalCompositeOperation = 'destination-out'       // monstera fenestration
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const y0 = H * (0.28 + i * 0.19), depth = W * (0.31 - i * 0.035)
      x.beginPath()
      x.moveTo(cx + s * W * 0.52, y0 - H * 0.055)
      x.quadraticCurveTo(cx + s * (W * 0.5 - depth * 0.5), y0 - H * 0.004, cx + s * (W * 0.5 - depth), y0 + H * 0.012)
      x.quadraticCurveTo(cx + s * (W * 0.5 - depth * 0.5), y0 + H * 0.038, cx + s * W * 0.52, y0 + H * 0.08)
      x.closePath(); x.fill()
    }
    x.globalCompositeOperation = 'source-atop'
    x.strokeStyle = `hsla(${hue - 14},40%,20%,0.45)`; x.lineWidth = 3
    x.beginPath(); x.moveTo(cx, H * 0.97); x.lineTo(cx, H * 0.05); x.stroke()
    x.lineWidth = 1.8
    for (let i = 0; i < 6; i++) {                        // lateral veins out to the rim
      const y0 = H * (0.22 + i * 0.13)
      for (const s of [-1, 1]) {
        x.beginPath(); x.moveTo(cx, y0)
        x.quadraticCurveTo(cx + s * W * 0.24, y0 - H * 0.02, cx + s * W * 0.5, y0 + H * 0.035)
        x.stroke()
      }
    }
    x.strokeStyle = 'rgba(255,255,255,0.13)'; x.lineWidth = 5
    x.beginPath(); x.moveTo(cx - 5, H * 0.9); x.lineTo(cx - 5, H * 0.1); x.stroke()
    x.globalCompositeOperation = 'source-over'
  }
  return c
}

let LEAF = null
function leafMats(kind) {
  if (!LEAF) LEAF = {}
  if (LEAF[kind]) return LEAF[kind]
  const hues = kind === 'fern' ? [104, 118, 92] : [126, 138, 112]
  LEAF[kind] = hues.map((h) => new THREE.MeshStandardMaterial({
    map: tex(leafCanvas(kind, h)), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.72, metalness: 0,
  }))
  return LEAF[kind]
}

let STEM_GEO = null, BLADE_GEO = null
function foliageGeo() {
  if (!STEM_GEO) {
    STEM_GEO = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true)   // unit tube, scaled per stem
    BLADE_GEO = new THREE.PlaneGeometry(1, 1, 2, 2)
    const p = BLADE_GEO.attributes.position                      // cup the blade so it isn't a flat card
    for (let i = 0; i < p.count; i++) p.setZ(i, -0.10 * p.getX(i) * p.getX(i))
    BLADE_GEO.computeVertexNormals()
  }
  return { STEM_GEO, BLADE_GEO }
}

export function buildPlant(size = 1, kind = 'monstera') {
  const g = new THREE.Group(); g.name = 'plant'
  const m = mats(), S = size, fern = kind === 'fern'
  const { STEM_GEO: stemGeo, BLADE_GEO: bladeGeo } = foliageGeo()
  const blades = leafMats(fern ? 'fern' : 'monstera')

  const pot = new THREE.Mesh(lathe([
    [0, 0], [0.068, 0], [0.073, 0.012], [0.088, 0.072], [0.104, 0.168], [0.110, 0.214],
    [0.115, 0.230], [0.107, 0.244], [0.097, 0.238], [0.092, 0.198],
  ], 16, S), m.pot)
  const soilY = 0.216 * S
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.092 * S, 0.086 * S, 0.018 * S, 14), m.soil)
  soil.position.y = soilY - 0.008 * S
  g.add(pot, soil)

  const r = rng(fern ? 91 : 42)
  const count = fern ? 15 : 11
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1)                       // 0 = tall inner shoot, 1 = low outer one
    const arm = new THREE.Group()                   // everything below bows out along +X
    arm.position.set(0, soilY, 0)
    arm.rotation.y = i * 2.39996 + r() * 0.5        // golden-angle phyllotaxis + jitter
    // Inner shoots stand tall, outer ones arch over — shortened as they lean so the crown
    // stays roughly as wide as it is high instead of sprawling.
    const t1 = 0.09 + 0.28 * u + r() * 0.09
    const t2 = t1 + (fern ? 0.26 + 0.48 * u : 0.28 + 0.60 * u)
    const L1 = (0.17 - 0.02 * u) * S, L2 = (0.12 - 0.01 * u) * S
    const rad = (fern ? 0.005 : 0.007) * S

    const s1 = new THREE.Mesh(stemGeo, m.stem)
    s1.scale.set(rad, L1, rad)
    s1.rotation.z = -t1                             // -Z rotation tips +Y toward +X
    s1.position.set(Math.sin(t1) * L1 / 2, Math.cos(t1) * L1 / 2, 0)
    const tipX = Math.sin(t1) * L1, tipY = Math.cos(t1) * L1
    const s2 = new THREE.Mesh(stemGeo, m.stem)
    s2.scale.set(rad * 0.85, L2, rad * 0.85)
    s2.rotation.z = -t2
    s2.position.set(tipX + Math.sin(t2) * L2 / 2, tipY + Math.cos(t2) * L2 / 2, 0)

    const pivot = new THREE.Group()                 // sits at the stem tip, +Y along the stem
    pivot.position.set(tipX + Math.sin(t2) * L2, tipY + Math.cos(t2) * L2, 0)
    pivot.rotation.z = -t2
    const len = (fern ? 0.22 + 0.05 * (1 - u) : 0.19 + 0.08 * (1 - u)) * S
    const leaf = new THREE.Mesh(bladeGeo, blades[i % blades.length])
    leaf.scale.set(len * (fern ? 0.32 : 0.80), len, 1)
    leaf.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.9   // turn the blade off the radial plane
    leaf.position.y = len * 0.44
    pivot.add(leaf)
    arm.add(s1, s2, pivot)
    g.add(arm)
  }
  g.add(contactShadow(0.30 * S, 0.30 * S, 0.42))
  return g
}

/* ---------- 6. book stack (sits on furniture — no ground shadow) ---------- */

const STACK_COLORS = ['#0b4bad', '#8a3033', '#2f6b4f', '#7a5c2e', '#3b2f52', '#1f4f5e']

export function buildBookStack(n = 3) {
  const g = new THREE.Group(); g.name = 'bookStack'
  const r = rng(1701 + n)
  const pages = new THREE.MeshStandardMaterial({ color: '#ddd2b4', roughness: 0.95, metalness: 0 })
  let y = 0
  for (let i = 0; i < n; i++) {
    const w = 0.22 + (r() - 0.5) * 0.024, d = 0.16 + (r() - 0.5) * 0.018
    const t = 0.025 + r() * 0.020
    const cover = new THREE.MeshStandardMaterial({ color: STACK_COLORS[(i * 2 + n) % STACK_COLORS.length], roughness: 0.72, metalness: 0.03 })
    const book = new THREE.Group()
    // boards + spine as thin shells, so the cream page block shows on the other three edges
    const boardGeo = new THREE.BoxGeometry(w, 0.004, d)
    const bottom = new THREE.Mesh(boardGeo, cover); bottom.position.y = 0.002
    const top = new THREE.Mesh(boardGeo, cover); top.position.y = t - 0.002
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.005, t, d), cover)
    spine.position.set(-w / 2 + 0.0025, t / 2, 0)
    const block = new THREE.Mesh(new THREE.BoxGeometry(w - 0.010, t - 0.010, d - 0.007), pages)
    block.position.set(0.003, t / 2, 0)
    book.add(bottom, top, spine, block)
    book.position.set((r() - 0.5) * 0.014, y, (r() - 0.5) * 0.012)
    book.rotation.y = (r() - 0.5) * 0.22
    g.add(book)
    y += t + 0.001
  }
  return g
}

/* ---------- 7. rolling library ladder ---------- */

export function buildRollingLadder() {
  const g = new THREE.Group(); g.name = 'rollingLadder'
  const m = mats()
  const L = 2.6, x0 = 0.20
  const lean = new THREE.Group()
  lean.rotation.x = -0.21          // ~12° off vertical, top toward -Z, pivoting on the feet
  g.add(lean)

  const railGeo = new THREE.BoxGeometry(0.05, L - 0.10, 0.034)
  const capGeo = new THREE.SphereGeometry(0.025, 8, 4, 0, TAU, 0, Math.PI / 2)
  const hookGeo = new THREE.TorusGeometry(0.05, 0.012, 5, 12, Math.PI * 1.3)
  hookGeo.rotateY(Math.PI / 2)     // ring plane XY -> YZ so the hook curls over a front rail
  const wheelGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.022, 12)
  wheelGeo.rotateZ(Math.PI / 2)
  const hubGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.026, 8)
  hubGeo.rotateZ(Math.PI / 2)

  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, m.woodDark)
    rail.position.set(s * x0, 0.10 + (L - 0.10) / 2, 0)
    const cap = new THREE.Mesh(capGeo, m.woodDark)
    cap.position.set(s * x0, L, 0); cap.scale.set(2.0, 1.0, 1.36)
    const hook = new THREE.Mesh(hookGeo, m.brass)
    hook.position.set(s * x0, L - 0.03, 0.055)
    const wheel = new THREE.Mesh(wheelGeo, m.rubber)
    wheel.position.set(s * (x0 + 0.018), 0.046, 0)
    const hub = new THREE.Mesh(hubGeo, m.brassDim)
    hub.position.set(s * (x0 + 0.018), 0.046, 0)
    lean.add(rail, cap, hook, wheel, hub)
  }

  const rungGeo = new THREE.CylinderGeometry(0.019, 0.019, x0 * 2, 10)
  rungGeo.rotateZ(Math.PI / 2)
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(rungGeo, m.woodWarm)
    rung.position.set(0, 0.34 + i * 0.46, 0)
    lean.add(rung)
  }

  const sh = contactShadow(0.62, 0.95, 0.32)
  sh.position.z = -0.22            // pooled under the leaning body, not just the feet
  g.add(sh)
  return g
}
