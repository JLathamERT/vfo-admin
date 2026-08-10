// The VFO Library — walkable 3D bookstore of VFO specialists (standalone page, no framework).
// Scene/engine core. Data rules live in data.js (mirrors the public widget, gotchas #201/#231);
// cover art in covers.js; the accessible 2D fallback in list.js.
// Art direction: narrow cozy corner bookshop — deep blue walls, floor-to-ceiling shelves,
// beamed ceiling with globe pendants, glazed storefront at the end of the aisle with daylight.
import * as THREE from 'three'
import { loadSpecialists, ECOSYSTEMS, ECO_COLORS } from './data.js'
import { ensureFonts, drawFrontCover, drawBackCover, drawSpine, drawPagesTexture } from './covers.js'
import { initListView } from './list.js'
import {
  plasterWallTexture, floorPlankTexture, floorRoughnessTexture,
  shelfWoodTexture, shelfWoodRoughnessTexture, spineRowTexture, ceilingTexture,
} from './textures.js'
import {
  contactShadow, buildArmchair, buildSideTable, buildFloorLamp,
  buildPlant, buildBookStack, buildRollingLadder,
} from './props.js'

const $ = (id) => document.getElementById(id)

// ---------- dimensions (meters) ----------
const ROOM = { w: 5.6, d: 10, h: 3.35 }              // narrow aisle shop; glass storefront at z=-5
const EYE = 1.55
const BOOK = { w: 0.235, h: 0.335, d: 0.034 }
const CASE_H = 2.9, CASE_D = 0.36
// Shelf boards by their TOP surface height; books/spine blocks SIT on them.
const BOARD_TOPS = [0.30, 0.88, 1.46, 2.04, 2.62]
const DISPLAY_BOARDS = [0.88, 1.46, 2.04]            // rows that hold the real face-out books
const SLAB_H = 0.26
const bookY = (t) => t + 0.172                        // book center: bottom rests on the board
const WALK_BOUNDS = { minX: -1.65, maxX: 1.65, minZ: -3.9, maxZ: 3.85 }

const NAVY_WALL = '#26456e'
const FRAME_BLUE = '#16294a'
const CREAM = '#e8dcc0'

const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const COARSE = window.matchMedia('(pointer: coarse)').matches
const D = (s) => (REDUCE ? 0.01 : s)                 // tween duration helper

// ---------- module state ----------
let renderer, scene, camera, raycaster
let yaw = 0, pitch = 0                                // camera default faces -z: down the aisle to the glass
let state = 'loading'                                 // loading | enter | walk | inspect | list
let books = []                                        // meshes (raycast targets)
let floorMesh = null, reticle = null
let glideTarget = null
let hovered = null
let held = null                                       // { mesh, group, home:{parent,pos,quat}, spec, eco }
let inspectHolder = null
let listApi = null, entered = false, webglOK = true
let needRender = true, rafId = 0, running = false
const keys = new Set()
const tweens = []
const texCache = new Map()                            // `${spec.id}|${eco}` -> { spine, front, frontHi, back }
const pointer = { down: false, id: null, x: 0, y: 0, sx: 0, sy: 0, moved: 0, t: 0 }
let hoverPending = null                               // latest mouse position awaiting a hover raycast

// ---------- small helpers ----------
function setState(next) {
  const wasInspect = state === 'inspect'
  state = next
  document.body.className = 'state-' + next
  // Entering inspect defers its native-res bump to the END of the pickup animation
  // (buffer resize mid-tween makes the pickup feel heavy); leaving drops res at once.
  if (wasInspect && next !== 'inspect') applyRenderScale()
  const hint = $('hint-bar')
  if (next === 'walk') {
    hint.textContent = COARSE
      ? 'Drag to look around · Tap the floor to walk · Tap a book to pick it up'
      : 'Drag to look around · Click the floor or use WASD to walk · Click a book to take it off the shelf'
  } else if (next === 'inspect') {
    hint.textContent = 'Drag to spin the book · Flip it over to read the back · Click anywhere else to put it back'
  }
  invalidate()
}

function invalidate() { needRender = true }

function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

// Cancels only tweens that animate the SAME channel on the same target — a scale tween
// (hover) must never kill an in-flight position tween (a book returning to its shelf).
function tween(target, { pos, quat, scale, dur = 0.5, ease = easeInOutCubic, onDone }) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]
    if (tw.target !== target) continue
    if ((pos && tw.toPos) || (quat && tw.toQuat) || (scale && tw.toScale)) tweens.splice(i, 1)
  }
  tweens.push({
    target, t: 0, dur: Math.max(dur, 0.001), ease, onDone,
    fromPos: target.position.clone(), toPos: pos ? pos.clone() : null,
    fromQuat: target.quaternion.clone(), toQuat: quat ? quat.clone() : null,
    fromScale: target.scale.clone(), toScale: scale ? scale.clone() : null,
  })
  invalidate()
}

function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]
    tw.t = Math.min(tw.t + dt / tw.dur, 1)
    const k = tw.ease(tw.t)
    if (tw.toPos) tw.target.position.lerpVectors(tw.fromPos, tw.toPos, k)
    if (tw.toQuat) tw.target.quaternion.slerpQuaternions(tw.fromQuat, tw.toQuat, k)
    if (tw.toScale) tw.target.scale.lerpVectors(tw.fromScale, tw.toScale, k)
    if (tw.t >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone() }
    invalidate()
  }
}

function canvasTex(canvas) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = Math.min(16, renderer ? renderer.capabilities.getMaxAnisotropy() : 4)
  return t
}

// Data maps (roughness) must stay linear — never SRGB.
function dataTex(canvas) {
  const t = new THREE.CanvasTexture(canvas)
  t.anisotropy = Math.min(8, renderer ? renderer.capabilities.getMaxAnisotropy() : 4)
  return t
}

// Deterministic 32-bit hash — placement stays stable for a specialist as others get added.
function hash32(a, b) {
  let h = Math.imul(a ^ 0x9E3779B9, 2654435761)
  h = Math.imul(h ^ (h >>> 13) ^ b, 0x85EBCA6B)
  return (h ^ (h >>> 16)) >>> 0
}

function std(opts) { return new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, envMapIntensity: 0.55, ...opts }) }

// Box that renders in 3 draw calls instead of 6: front face + everything-else + back,
// with a 2-entry material array [rest, front]. Cuts hundreds of draw calls on shelf fillers.
function frontBoxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.clearGroups()
  g.addGroup(0, 24, 0)    // +x, -x, +y, -y
  g.addGroup(24, 6, 1)    // +z front
  g.addGroup(30, 6, 0)    // -z back
  return g
}

// ---------- procedural textures & branding ----------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

// The VFO mark: six interlocking circles (mirrors /vfo-icon.svg geometry).
function drawVfoMark(ctx, cx, cy, r, color, lineW) {
  const s = r / 5.8
  const centers = [[4.4, 0], [2.2, 3.81], [-2.2, 3.81], [-4.4, 0], [-2.2, -3.81], [2.2, -3.81]]
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineW
  for (const [ox, oy] of centers) {
    ctx.beginPath()
    ctx.arc(cx + ox * s, cy + oy * s, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function rugTexture() {
  const c = makeCanvas(512, 340), x = c.getContext('2d')
  x.fillStyle = '#0f2d63'; x.fillRect(0, 0, 512, 340)
  x.strokeStyle = CREAM; x.lineWidth = 6; x.strokeRect(16, 16, 480, 308)
  x.lineWidth = 2; x.strokeRect(30, 30, 452, 280)
  drawVfoMark(x, 256, 148, 52, CREAM, 5)
  x.fillStyle = CREAM
  x.font = '700 20px "DM Sans", sans-serif'
  x.textAlign = 'center'; x.textBaseline = 'middle'
  x.fillText('T H E   V F O   L I B R A R Y', 256, 272)
  for (let i = 0; i < 2200; i++) {                   // woven texture noise
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,210' : '0,10,30'},${0.03 + Math.random() * 0.05})`
    x.fillRect(Math.random() * 512, Math.random() * 340, 2, 1)
  }
  return c
}

// Small navy header board mounted on a bookcase: mark + ecosystem name + count.
function caseHeaderTexture(title, sub) {
  const c = makeCanvas(640, 96), x = c.getContext('2d')
  x.fillStyle = '#0d2044'; x.fillRect(0, 0, 640, 96)
  x.strokeStyle = CREAM; x.lineWidth = 2; x.strokeRect(6, 6, 628, 84)
  drawVfoMark(x, 52, 48, 20, CREAM, 2.5)
  x.fillStyle = CREAM; x.textAlign = 'left'; x.textBaseline = 'middle'
  x.font = '600 34px "Playfair Display", Georgia, serif'
  x.fillText(title, 96, sub ? 38 : 48)
  if (sub) {
    x.font = '700 17px "DM Sans", sans-serif'
    x.globalAlpha = 0.72
    x.fillText(String(sub).toUpperCase(), 97, 71)
    x.globalAlpha = 1
  }
  const band = ECO_COLORS[title]
  if (band) { x.fillStyle = band; x.fillRect(614, 6, 20, 84) }
  return c
}

// Wide branding board above the storefront glass, facing into the shop.
function libraryBoardTexture() {
  const c = makeCanvas(1024, 176), x = c.getContext('2d')
  x.fillStyle = '#0d2044'; x.fillRect(0, 0, 1024, 176)
  x.strokeStyle = CREAM; x.lineWidth = 3; x.strokeRect(10, 10, 1004, 156)
  x.lineWidth = 1; x.globalAlpha = 0.6; x.strokeRect(20, 20, 984, 136); x.globalAlpha = 1
  drawVfoMark(x, 110, 88, 34, CREAM, 3.5)
  x.fillStyle = CREAM; x.textAlign = 'center'; x.textBaseline = 'middle'
  x.font = '700 68px "Playfair Display", Georgia, serif'
  x.fillText('THE VFO LIBRARY', 545, 92)
  return c
}

// Window vinyl: "VFO SERVICES" painted for the street, so it reads mirrored from inside.
function windowDecalTexture() {
  const c = makeCanvas(512, 128), x = c.getContext('2d')
  x.translate(512, 0); x.scale(-1, 1)
  x.fillStyle = 'rgba(13,32,68,0.92)'               // navy vinyl reads against the bright beach
  x.textAlign = 'center'; x.textBaseline = 'middle'
  x.font = '700 44px "Playfair Display", Georgia, serif'
  x.fillText('VFO SERVICES', 256, 46)
  x.font = '700 16px "DM Sans", sans-serif'
  x.fillText('· SPECIALIST SHOWROOM ·', 256, 94)
  return c
}

// Framed wall art: typographic VFO posters for the bare wall segments.
function posterTexture(kind) {
  const c = makeCanvas(384, 512), x = c.getContext('2d')
  x.fillStyle = '#f4ecdc'; x.fillRect(0, 0, 384, 512)
  x.strokeStyle = '#0d2044'; x.lineWidth = 3; x.strokeRect(14, 14, 356, 484)
  x.textAlign = 'center'; x.textBaseline = 'middle'
  if (kind === 'mark') {
    // mark extent: cy ± (offset + radius) — keep the wordmark clear below it
    drawVfoMark(x, 192, 168, 62, '#125ecc', 5)
    x.fillStyle = '#0d2044'
    x.font = '700 40px "Playfair Display", Georgia, serif'
    x.fillText('VFO', 192, 356)
    x.font = '700 17px "DM Sans", sans-serif'
    x.globalAlpha = 0.7
    x.fillText('S E R V I C E S', 192, 400)
    x.globalAlpha = 1
  } else {
    x.font = '700 26px "Playfair Display", Georgia, serif'
    x.fillStyle = '#0d2044'
    x.fillText('THE FIVE', 192, 64)
    x.fillText('ECOSYSTEMS', 192, 98)
    ECOSYSTEMS.forEach((eco, i) => {
      const y = 150 + i * 66
      x.fillStyle = ECO_COLORS[eco]
      x.fillRect(52, y, 34, 34)
      x.fillStyle = '#0d2044'
      x.textAlign = 'left'
      x.font = '600 21px "Playfair Display", Georgia, serif'
      x.fillText(eco, 104, y + 17)
      x.textAlign = 'center'
    })
  }
  return c
}

function pictureFrame(tex, w, h) {
  const g = new THREE.Group()
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), std({ color: '#0d2044', roughness: 0.5 }))
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: tex, roughness: 0.8 }))
  art.position.z = 0.025
  g.add(frame, art)
  return g
}

// Sky only — everything else outside is real 3D now. Featureless gradients are the one
// thing a painted plane does convincingly.
function skyTexture() {
  const c = makeCanvas(1024, 512), x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0, '#6fb2e4'); g.addColorStop(0.55, '#a9d2ee'); g.addColorStop(0.85, '#dcebe6'); g.addColorStop(1, '#efe9d5')
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512)
  const glow = x.createRadialGradient(790, 90, 30, 790, 90, 400)
  glow.addColorStop(0, 'rgba(255,248,222,0.9)'); glow.addColorStop(1, 'rgba(255,248,222,0)')
  x.fillStyle = glow; x.fillRect(0, 0, 1024, 512)
  for (const [cx2, cy, s] of [[220, 150, 1.1], [620, 220, 0.7], [900, 160, 0.9]]) {
    for (let i = 0; i < 8; i++) {
      const off = (i - 4) * 26 * s
      x.fillStyle = `rgba(255,255,255,${0.28 + Math.random() * 0.2})`
      x.beginPath()
      x.ellipse(cx2 + off, cy - Math.abs(off) * 0.16, (30 + Math.random() * 18) * s, (14 + Math.random() * 8) * s, 0, 0, Math.PI * 2)
      x.fill()
    }
    x.fillStyle = 'rgba(150,165,185,0.2)'
    x.beginPath(); x.ellipse(cx2, cy + 13 * s, 96 * s, 7 * s, 0, 0, Math.PI * 2); x.fill()
  }
  return c
}

function sandTexture() {
  const c = makeCanvas(512, 512), x = c.getContext('2d')
  x.fillStyle = '#d9c49a'; x.fillRect(0, 0, 512, 512)
  for (let y = 0; y < 512; y += 2) {                  // faint wind-ripple banding
    const k = Math.sin(y * 0.11) * 0.5 + Math.sin(y * 0.031 + 2) * 0.5
    x.fillStyle = k > 0 ? `rgba(255,240,205,${k * 0.07})` : `rgba(120,95,60,${-k * 0.06})`
    x.fillRect(0, y, 512, 2)
  }
  for (let i = 0; i < 5200; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(115,90,55,0.14)' : 'rgba(255,246,218,0.18)'
    x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random(), 1)
  }
  for (let i = 0; i < 12; i++) {                      // occasional pebble
    x.fillStyle = ['#c9b698', '#b3a184', '#dccdb0'][(Math.random() * 3) | 0]
    x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, 2.5, 1.6, Math.random(), 0, Math.PI * 2); x.fill()
  }
  return c
}

// Grass card: a dense tuft of curved blades; `tall` adds wheat-colored seed heads (sea oats).
function grassTuftTexture(tall = false) {
  const c = makeCanvas(128, 160), x = c.getContext('2d')
  const n = tall ? 12 : 18
  for (let i = 0; i < n; i++) {
    x.strokeStyle = `rgba(${96 + Math.random() * 46 | 0},${118 + Math.random() * 42 | 0},${58 + Math.random() * 22 | 0},0.95)`
    x.lineWidth = 1.5 + Math.random() * 1.2
    const bx = 50 + Math.random() * 28
    const tipX = bx + (Math.random() - 0.5) * 84
    const tipY = tall ? 8 + Math.random() * 24 : 34 + Math.random() * 34
    x.beginPath()
    x.moveTo(bx, 158)
    x.quadraticCurveTo(bx + (Math.random() - 0.5) * 30, 88 - Math.random() * 26, tipX, tipY)
    x.stroke()
    if (tall && Math.random() < 0.8) {                // drooping seed head at the tip
      x.fillStyle = `rgba(${196 + Math.random() * 30 | 0},${172 + Math.random() * 26 | 0},110,0.95)`
      x.save(); x.translate(tipX, tipY); x.rotate((Math.random() - 0.5) * 1.2)
      x.beginPath(); x.ellipse(0, 0, 2.4, 7 + Math.random() * 5, 0, 0, Math.PI * 2); x.fill()
      x.restore()
    }
  }
  return c
}

// Weathered boardwalk planks: vertical strips (plank long-axis = walkway depth).
function boardwalkTexture() {
  const c = makeCanvas(512, 256), x = c.getContext('2d')
  x.fillStyle = '#6e5c46'; x.fillRect(0, 0, 512, 256)
  const plankW = 44
  for (let col = 0; col < 512 / plankW + 1; col++) {
    const px = col * plankW
    const tone = 118 + Math.random() * 48
    x.fillStyle = `rgb(${tone | 0},${tone * 0.86 | 0},${tone * 0.66 | 0})`
    x.fillRect(px + 2, 0, plankW - 4, 256)
    for (let i = 0; i < 16; i++) {                    // grain
      x.fillStyle = `rgba(52,40,28,${0.08 + Math.random() * 0.14})`
      x.fillRect(px + 3 + Math.random() * (plankW - 8), Math.random() * 256, 1, 30 + Math.random() * 120)
    }
    for (let i = 0; i < 5; i++) {                     // sun-bleached patches
      x.fillStyle = `rgba(214,200,176,${0.06 + Math.random() * 0.09})`
      x.fillRect(px + 3, Math.random() * 240, plankW - 6, 6 + Math.random() * 18)
    }
    x.fillStyle = 'rgba(24,18,12,0.72)'; x.fillRect(px, 0, 2, 256)      // gap
    if (Math.random() < 0.7) {                        // knot
      x.fillStyle = 'rgba(58,44,30,0.7)'
      x.beginPath(); x.ellipse(px + 8 + Math.random() * (plankW - 16), Math.random() * 256, 2.6, 3.6, 0, 0, Math.PI * 2); x.fill()
    }
    x.fillStyle = 'rgba(40,32,24,0.9)'                // nail pairs top + bottom
    for (const ny of [18, 238]) { x.fillRect(px + 10, ny, 2, 2); x.fillRect(px + plankW - 12, ny, 2, 2) }
  }
  return c
}

// A wind-piled dune lobe: heavy multi-frequency displacement + a leaning crest
// (gentle windward slope, steeper lee) so nothing reads as a dome.
function duneLobe(tone, sandTex) {
  const geo = new THREE.SphereGeometry(1, 30, 20)
  const pos = geo.attributes.position
  const p1 = Math.random() * 10, p2 = Math.random() * 10, p3 = Math.random() * 10
  const amp = 0.13 + Math.random() * 0.08              // subtle: the grass carries the look now
  const lean = 0.1 + Math.random() * 0.1
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i)
    const n =
      Math.sin(vx * 2.6 + p1) * Math.cos(vz * 2.2 + p2) * 0.45 +
      Math.sin(vx * 5.7 + vz * 4.9 + p2) * 0.3 +
      Math.sin(vx * 11.3 + vz * 9.1 + p3) * 0.15 +
      Math.sin(vy * 4.7 + vx * 2.2 + p1) * 0.2
    const k = 1 + n * amp
    // crest lean: the top drifts leeward, flattening one face and steepening the other
    pos.setXYZ(i, vx * k + Math.max(0, vy) * vy * lean, vy * k * (0.85 + 0.3 * Math.abs(n)), vz * k)
  }
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, std({ map: sandTex, color: tone, roughness: 0.98 }))
}

// A dune is a CLUSTER of 2-3 overlapping lobes — compound silhouettes, never one blob.
function makeDune(sx, sy, sz, tone, sandTex) {
  const g = new THREE.Group()
  const main = duneLobe(tone, sandTex)
  main.scale.set(sx, sy, sz)
  g.add(main)
  const lobes = 1 + (Math.random() < 0.6 ? 1 : 0)
  for (let i = 0; i < lobes; i++) {
    const side = duneLobe(tone, sandTex)
    const k = 0.35 + Math.random() * 0.35
    side.scale.set(sx * k, sy * (0.45 + Math.random() * 0.35), sz * k)
    side.position.set((Math.random() < 0.5 ? -1 : 1) * sx * (0.55 + Math.random() * 0.35), 0, (Math.random() - 0.5) * sz * 0.9)
    side.rotation.y = Math.random() * Math.PI
    g.add(side)
  }
  return g
}

// Real 3D beach outside the glass: boardwalk along the storefront, sand, displaced
// dunes buried in grass (they hide the horizon — beachy, no water), driftwood.
function buildBeachOutside() {
  const g = new THREE.Group()
  const sandT = canvasTex(sandTexture())
  sandT.wrapS = sandT.wrapT = THREE.RepeatWrapping
  sandT.repeat.set(10, 5)
  const duneSandT = sandT.clone()
  duneSandT.repeat.set(3, 2)
  duneSandT.needsUpdate = true

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 12), std({ map: sandT, roughness: 0.95 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.012, -ROOM.d / 2 - 6)   // runs past the dunes to under the sky plane
  g.add(ground)

  // ---- boardwalk promenade along the storefront ----
  const walkT = canvasTex(boardwalkTexture())
  walkT.wrapS = walkT.wrapT = THREE.RepeatWrapping
  walkT.repeat.set(9, 1)
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.3), std({ map: walkT, roughness: 0.8 }))
  deck.rotation.x = -Math.PI / 2
  deck.position.set(0, 0.02, -ROOM.d / 2 - 1.16)
  g.add(deck)
  const edgeMat = std({ color: '#6e5c46', roughness: 0.75 })
  const edge = new THREE.Mesh(new THREE.BoxGeometry(15, 0.09, 0.12), edgeMat)
  edge.position.set(0, 0.045, -ROOM.d / 2 - 2.32)
  g.add(edge)
  // posts + sagging rope along the sand side
  const postGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.62, 8)
  const posts = []
  for (const px of [-7.2, -3.6, 0, 3.6, 7.2]) {
    const post = new THREE.Mesh(postGeo, std({ color: '#7d6a52', roughness: 0.8 }))
    post.position.set(px, 0.31, -ROOM.d / 2 - 2.38)
    post.rotation.z = (Math.random() - 0.5) * 0.05
    g.add(post)
    posts.push(px)
  }
  const ropeMat = std({ color: '#c9b68e', roughness: 0.9 })
  for (let i = 0; i < posts.length - 1; i++) {
    const a = new THREE.Vector3(posts[i], 0.56, -ROOM.d / 2 - 2.38)
    const b = new THREE.Vector3(posts[i + 1], 0.56, -ROOM.d / 2 - 2.38)
    const mid = a.clone().lerp(b, 0.5); mid.y = 0.38   // catenary sag
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 12, 0.018, 6), ropeMat)
    g.add(rope)
  }

  // ---- dunes: LOW sand swells (grass does the talking) + a long berm hiding the horizon ----
  const duneDefs = [
    [-7.5, -8.6, 4.6, 0.8, 2.8, '#dcc7a0'], [-2.5, -9.4, 3.8, 0.6, 2.4, '#d5bf95'],
    [1.8, -8.8, 4.4, 0.85, 2.6, '#e0cba2'], [6.8, -9.0, 5.0, 0.7, 3.0, '#d8c298'],
    [-10.5, -7.2, 3.4, 0.55, 2.2, '#d5bf95'], [10.3, -7.6, 3.8, 0.65, 2.4, '#dcc7a0'],
    [-5.2, -7.4, 2.6, 0.4, 1.7, '#e0cba2'], [4.2, -7.0, 2.4, 0.38, 1.6, '#d9c398'],
    [-8, -11.4, 13, 0.95, 3.2, '#d8c298'], [8, -11.6, 13, 0.9, 3.4, '#dcc7a0'],
  ]
  const dunes = []
  for (const [dx, dz, sx, sy, sz, tone] of duneDefs) {
    const dune = makeDune(sx, sy, sz, tone, duneSandT)
    dune.position.set(dx, 0, -ROOM.d / 2 + dz)
    g.add(dune)
    dunes.push({ dx, dz: -ROOM.d / 2 + dz, sx, sy, sz })
  }

  // ---- grass: dunes BURIED in it (~550 instanced blades in two draw calls) ----
  const grassMatShort = std({ map: canvasTex(grassTuftTexture(false)), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.85 })
  const grassMatTall = std({ map: canvasTex(grassTuftTexture(true)), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.85 })
  const grassGeo = new THREE.PlaneGeometry(0.8, 1.0)
  const shortMats = [], tallMats = []
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s3 = new THREE.Vector3()
  const addTuft = (px, py, pz, s, tall) => {
    for (const ry of [0, Math.PI / 2.6]) {
      _e.set(0, ry + px, (Math.random() - 0.5) * 0.12)
      const m = new THREE.Matrix4().compose(_v.set(px, py + 0.5 * s, pz), _q.setFromEuler(_e), _s3.set(s, s, s))
      ;(tall ? tallMats : shortMats).push(m)
    }
  }
  for (const d of dunes) {                            // dense cover seated on each swell
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.pow(Math.random(), 0.55) * 0.95
      const nx = Math.cos(a) * r, nz = Math.sin(a) * r
      const py = d.sy * Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz)) * 0.9
      addTuft(d.dx + nx * d.sx, py - 0.05, d.dz + nz * d.sz, 0.5 + Math.random() * 0.6, Math.random() < 0.55)
    }
  }
  for (let i = 0; i < 34; i++) {                      // strays on the open sand
    const px = -11 + Math.random() * 22
    const pz = -ROOM.d / 2 - 2.8 - Math.random() * 3.6
    addTuft(px, -0.02, pz, 0.35 + Math.random() * 0.5, Math.random() < 0.3)
  }
  for (const px of [-8.6, -5.4, 5.2, 8.4]) {          // clumps hugging the boardwalk edge
    addTuft(px + (Math.random() - 0.5) * 0.5, 0, -ROOM.d / 2 - 2.55, 0.6 + Math.random() * 0.4, true)
  }
  for (const [mats, mat] of [[shortMats, grassMatShort], [tallMats, grassMatTall]]) {
    if (!mats.length) continue
    const inst = new THREE.InstancedMesh(grassGeo, mat, mats.length)
    mats.forEach((m, i) => inst.setMatrixAt(i, m))
    inst.instanceMatrix.needsUpdate = true
    g.add(inst)
  }

  // ---- driftwood: bleached, half-sunk ----
  for (const [wx, wz, len, rot] of [[-4.8, -5.6, 1.4, 0.4], [3.4, -6.2, 1.0, -1.1], [8.8, -5.2, 1.7, 2.2]]) {
    const wood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, len, 7),
      std({ color: '#a8977e', roughness: 0.9 })
    )
    wood.rotation.z = Math.PI / 2
    wood.rotation.y = rot
    wood.position.set(wx, 0.045, -ROOM.d / 2 + wz)
    g.add(wood)
    const shadow = contactShadow(len * 1.1, 0.3, 0.3)
    shadow.position.x = wx; shadow.position.z = -ROOM.d / 2 + wz
    g.add(shadow)
  }

  return g
}


// A longboard leaning against the storefront, seen through the right window.
function buildSurfboard() {
  const g = new THREE.Group()
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.98)
  shape.bezierCurveTo(0.23, 0.62, 0.25, 0.1, 0.19, -0.62)
  shape.bezierCurveTo(0.15, -0.94, -0.15, -0.94, -0.19, -0.62)
  shape.bezierCurveTo(-0.25, 0.1, -0.23, 0.62, 0, 0.98)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.018, bevelSegments: 2, curveSegments: 18 })
  geo.translate(0, 0, -0.025)
  g.add(new THREE.Mesh(geo, std({ color: '#f2e9d8', roughness: 0.3 })))
  for (const zz of [0.045, -0.045]) {                 // VFO-blue center stripe, both faces
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 1.78), std({ color: '#0b4bad', roughness: 0.3 }))
    stripe.position.z = zz
    if (zz < 0) stripe.rotation.y = Math.PI
    g.add(stripe)
  }
  return g
}

// Reading nook: composed from the props library — club chair, pedestal table
// with a book stack, and a lit floor lamp.
function armchairNook() {
  const g = new THREE.Group()
  g.add(buildArmchair())
  const table = buildSideTable()
  table.position.set(0.66, 0, 0.08)
  g.add(table)
  const stack = buildBookStack(3)
  stack.position.set(0.66, 0.549, 0.08)
  stack.rotation.y = 0.4
  g.add(stack)
  const lamp = buildFloorLamp()
  lamp.position.set(-0.62, 0, -0.18)
  g.add(lamp)
  return g
}

function pendantLamp(z, x = 0, lit = true) {
  const g = new THREE.Group()
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, ROOM.h - 2.5, 6), std({ color: '#2a2a2a', roughness: 0.5 }))
  cord.position.y = ROOM.h - (ROOM.h - 2.5) / 2
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), new THREE.MeshBasicMaterial({ color: '#ffe3ae' }))
  globe.position.y = 2.5
  g.add(cord, globe)
  if (lit) {                                          // every point light costs every pixel — glow is free, lights are not
    const light = new THREE.PointLight('#ffd9a0', 9, 6, 2)
    light.position.y = 2.45
    g.add(light)
  }
  g.position.set(x, 0, z)
  return g
}

function buildStorefront() {
  const g = new THREE.Group()
  const frame = std({ color: FRAME_BLUE, roughness: 0.55 })
  const glassMat = new THREE.MeshBasicMaterial({ color: '#cfe6f7', transparent: true, opacity: 0.12, depthWrite: false })
  const Z = -ROOM.d / 2

  const post = (x, w, h, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), frame); m.position.set(x, y, Z); g.add(m) }
  post(-ROOM.w / 2 + 0.11, 0.22, ROOM.h, ROOM.h / 2)               // corner posts
  post(ROOM.w / 2 - 0.11, 0.22, ROOM.h, ROOM.h / 2)
  post(-0.62, 0.14, 2.62, 1.31)                                     // door jambs
  post(0.62, 0.14, 2.62, 1.31)
  post(0, ROOM.w, 0.12, 0.06)                                       // threshold
  post(0, ROOM.w, 0.16, 2.62)                                       // header rail
  const header = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, ROOM.h - 2.7, 0.14), frame)
  header.position.set(0, (ROOM.h + 2.7) / 2, Z)
  g.add(header)

  // sills + under-window panels
  for (const side of [-1, 1]) {
    const cx = side * (0.62 + (ROOM.w / 2 - 0.22 - 0.62) / 2)
    const w = ROOM.w / 2 - 0.22 - 0.62 - 0.07
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.09, 0.2), frame); sill.position.set(cx, 0.5, Z)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.5, 0.14), frame); panel.position.set(cx, 0.25, Z)
    g.add(sill, panel)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.02), glassMat)
    glass.position.set(cx, 1.56, Z + 0.02); g.add(glass)
    const muntinH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), frame); muntinH.position.set(cx, 1.56, Z); g.add(muntinH)
    const muntinV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.02, 0.05), frame); muntinV.position.set(cx, 1.56, Z); g.add(muntinV)
  }

  // glazed door (closed) with 4 panes + handle + hanging OPEN board
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.5), glassMat)
  doorGlass.position.set(0, 1.31, Z + 0.02); g.add(doorGlass)
  const doorMidH = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.07, 0.06), frame); doorMidH.position.set(0, 1.31, Z); g.add(doorMidH)
  const doorMidV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.56, 0.06), frame); doorMidV.position.set(0, 1.31, Z); g.add(doorMidV)
  const doorBottom = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.5, 0.1), frame); doorBottom.position.set(0, 0.28, Z); g.add(doorBottom)
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8), std({ color: '#c9a24a', roughness: 0.3, metalness: 0.8 }))
  handle.position.set(0.45, 1.15, Z + 0.06); g.add(handle)

  const openC = makeCanvas(192, 96), ox = openC.getContext('2d')
  ox.fillStyle = '#0d2044'; ox.fillRect(0, 0, 192, 96)
  ox.strokeStyle = CREAM; ox.lineWidth = 3; ox.strokeRect(5, 5, 182, 86)
  ox.translate(192, 0); ox.scale(-1, 1)                             // faces the street
  ox.fillStyle = CREAM; ox.textAlign = 'center'; ox.textBaseline = 'middle'
  ox.font = '700 40px "DM Sans", sans-serif'; ox.fillText('OPEN', 96, 52)
  const open = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), std({ map: canvasTex(openC), roughness: 0.7 }))
  open.position.set(-0.28, 2.28, Z + 0.05); g.add(open)

  // branding board above the glass, facing into the shop
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.62), std({ map: canvasTex(libraryBoardTexture()), roughness: 0.6 }))
  board.position.set(0, 3.0, Z + 0.09); g.add(board)

  // mirrored window vinyl on the left window
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.34), new THREE.MeshBasicMaterial({ map: canvasTex(windowDecalTexture()), transparent: true }))
  decal.position.set(-(0.62 + (ROOM.w / 2 - 0.22 - 0.62) / 2), 1.78, Z + 0.03)
  g.add(decal)

  return g
}

// A tiny gradient "room" baked to an environment map gives every MeshStandardMaterial
// real-looking reflections/ambience without shipping an HDR file.
function buildEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const es = new THREE.Scene()
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ color: '#8a7a60', side: THREE.BackSide })))
  const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), new THREE.MeshBasicMaterial({ color: '#eaf4ff' }))
  win.position.set(0, 2, -6); es.add(win)
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }))
  warm.position.set(0, 4.5, 2); warm.rotation.x = Math.PI / 2; es.add(warm)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: '#5e4630' }))
  ground.rotation.x = -Math.PI / 2; ground.position.y = -2; es.add(ground)
  scene.environment = pmrem.fromScene(es, 0.06).texture
  pmrem.dispose()
}

let dprCap = 1.5
let LITE = false                                      // integrated-GPU profile: fewer lights, lower budget, no MSAA
let SOFTWARE = false                                  // no GPU at all (SwiftShader etc.) — hardware accel is off
let gpuString = 'unknown'
const DEBUG = new URLSearchParams(location.search).has('debug')

// The GPU must be known BEFORE the renderer exists — antialias is a creation-time flag.
function detectGpuProfile() {
  try {
    const probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')
    const ext = probe && probe.getExtension('WEBGL_debug_renderer_info')
    gpuString = ext ? String(probe.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'masked'
    SOFTWARE = /swiftshader|software|llvmpipe|microsoft basic/i.test(gpuString)
    LITE = SOFTWARE || /intel|uhd|iris|mali|adreno|powervr/i.test(gpuString)
  } catch { LITE = false }
  if (LITE) dprCap = 1.0
}

// Fill-rate is the integrated-GPU killer: bound TOTAL rendered pixels regardless of
// window size, so a full-screen 1080p/4K window costs the same as a modest one.
// EXCEPT while inspecting a book: the camera is frozen then, renders are rare, and the
// cover must be pin-sharp — so inspect mode always renders at native resolution.
function targetRatio() {
  const cap = Math.min(window.devicePixelRatio || 1, Math.max(dprCap, 1))
  if (state === 'inspect') return cap
  // SOFTWARE = CPU rasterizer (no GPU at all): resolution is nearly the whole cost there
  const budget = SOFTWARE ? 550000 : LITE ? 1200000 : 2600000
  const walkCap = Math.min(window.devicePixelRatio || 1, dprCap)
  return Math.min(walkCap, Math.sqrt(budget / (window.innerWidth * window.innerHeight)))
}

function applyRenderScale() {
  if (!renderer) return
  renderer.setPixelRatio(targetRatio())
  renderer.setSize(window.innerWidth, window.innerHeight)
  invalidate()
}

function buildRenderer() {
  const canvas = $('scene')
  detectGpuProfile()
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: 'high-performance' })
  renderer.setPixelRatio(targetRatio())
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.04
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fatal('Your graphics context was interrupted. Please try again.') })
}

function buildScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#bfe0f7')
  scene.fog = new THREE.Fog('#e8ddc8', 16, 30)

  camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.05, 40)
  camera.rotation.order = 'YXZ'
  camera.position.set(0, EYE, 3.2)
  scene.add(camera)

  inspectHolder = new THREE.Group()
  inspectHolder.position.set(0, -0.03, -0.5)
  camera.add(inspectHolder)

  raycaster = new THREE.Raycaster()
  buildEnvironment()

  // ---- light: bright warm daylight + golden pendants, no shadow maps ----
  scene.add(new THREE.HemisphereLight('#fff6e6', '#6b5540', 0.85))
  const sun = new THREE.DirectionalLight('#fff2d0', 2.2); sun.position.set(1.5, 4.5, -7); scene.add(sun)
  const fill = new THREE.DirectionalLight('#e8eeff', 0.45); fill.position.set(0, 4, 6); scene.add(fill)
  scene.add(pendantLamp(-2.2, 0.45, !LITE))
  scene.add(pendantLamp(0.3, -0.35))
  scene.add(pendantLamp(2.6, 0.45, false))

  // ---- floor (planks run down the aisle) + sun pools + rug ----
  const floorT = canvasTex(floorPlankTexture())
  const floorR = dataTex(floorRoughnessTexture())
  for (const t of [floorT, floorR]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.center.set(0.5, 0.5); t.rotation = Math.PI / 2
    t.repeat.set(1.9, 1.05)
  }
  floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), std({ map: floorT, roughnessMap: floorR, roughness: 1 }))
  floorMesh.rotation.x = -Math.PI / 2
  scene.add(floorMesh)

  const poolC = makeCanvas(128, 128), pxc = poolC.getContext('2d')
  const pg = pxc.createRadialGradient(64, 64, 8, 64, 64, 62)
  pg.addColorStop(0, 'rgba(255,240,200,0.55)'); pg.addColorStop(1, 'rgba(255,240,200,0)')
  pxc.fillStyle = pg; pxc.fillRect(0, 0, 128, 128)
  const poolT = canvasTex(poolC)
  for (const [px2, pz, s] of [[-0.9, -3.7, 2.2], [1.0, -3.9, 1.8]]) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 1.5), new THREE.MeshBasicMaterial({ map: poolT, transparent: true, depthWrite: false }))
    pool.rotation.x = -Math.PI / 2
    pool.position.set(px2, 0.015, pz)
    scene.add(pool)
  }

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.8), std({ map: canvasTex(rugTexture()), roughness: 0.95 }))
  rug.rotation.x = -Math.PI / 2
  rug.position.set(0, 0.012, -4.45)                  // doormat-sized, right at the threshold
  scene.add(rug)

  // ---- ceiling: warm white panels + dark beams across the aisle ----
  const ceilT = canvasTex(ceilingTexture())
  ceilT.wrapS = ceilT.wrapT = THREE.RepeatWrapping
  ceilT.repeat.set(2.2, 3.9)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), std({ map: ceilT, roughness: 0.95 }))
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = ROOM.h
  scene.add(ceil)
  const beamMat = std({ color: '#4a3520', roughness: 0.6 })
  for (let bz = -4.2; bz <= 4.4; bz += 1.2) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, 0.14, 0.18), beamMat)
    beam.position.set(0, ROOM.h - 0.07, bz)
    scene.add(beam)
  }

  // ---- walls: plastered deep blue + baseboards/crown; storefront glass wall at -z ----
  const plasterC = plasterWallTexture({ base: NAVY_WALL })
  const baseMat = std({ color: '#101f38', roughness: 0.6 })
  const mkWall = (w, x, z, ry) => {
    const wt = canvasTex(plasterC)
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping
    wt.repeat.set(w / 3.2, 1)
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), std({ map: wt, roughness: 0.88 }))
    wall.position.set(x, ROOM.h / 2, z); wall.rotation.y = ry
    scene.add(wall)
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.03), baseMat)
    skirt.position.set(x, 0.06, z); skirt.rotation.y = ry
    skirt.translateZ(0.016)
    scene.add(skirt)
    const crown = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.05), baseMat)
    crown.position.set(x, ROOM.h - 0.045, z); crown.rotation.y = ry
    crown.translateZ(0.026)
    scene.add(crown)
  }
  mkWall(ROOM.w, 0, ROOM.d / 2, Math.PI)          // rear wall
  mkWall(ROOM.d, -ROOM.w / 2, 0, Math.PI / 2)     // left
  mkWall(ROOM.d, ROOM.w / 2, 0, -Math.PI / 2)     // right
  scene.add(buildStorefront())

  // ---- outside: real 3D beach (sand, dunes, grass, umbrella) + painted sky + surfboard ----
  scene.add(buildBeachOutside())
  // sky wraps the whole scene as a cylinder — no edge to find at any viewing angle
  const skyT = canvasTex(skyTexture())
  skyT.wrapS = THREE.RepeatWrapping
  skyT.repeat.set(3, 1)
  const sky = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, 18, 28, 1, true),
    new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false })
  )
  sky.position.set(0, 5, -2)
  scene.add(sky)
  const board = buildSurfboard()
  board.position.set(1.72, 0.93, -ROOM.d / 2 - 0.17)
  board.rotation.x = 0.13                             // top rests on the storefront, tail in the sand
  board.rotation.z = -0.06
  scene.add(board)
  scene.background = new THREE.Color('#6fb2e4')

  // ---- framed prints on the otherwise-bare rear wall segments ----
  const frameL = pictureFrame(canvasTex(posterTexture('mark')), 0.66, 0.88)
  frameL.position.set(-ROOM.w / 2 + 0.03, 1.72, 4.1)
  frameL.rotation.y = Math.PI / 2
  scene.add(frameL)
  const frameR = pictureFrame(canvasTex(posterTexture('ecos')), 0.66, 0.88)
  frameR.position.set(ROOM.w / 2 - 0.03, 1.72, 4.1)
  frameR.rotation.y = -Math.PI / 2
  scene.add(frameR)
  const frameFront = pictureFrame(canvasTex(posterTexture('ecos')), 0.5, 0.66)
  frameFront.position.set(-ROOM.w / 2 + 0.03, 1.68, 0.72)
  frameFront.rotation.y = Math.PI / 2
  scene.add(frameFront)

  // ---- armchair nook + door plant (front corners, by the glass) ----
  const nook = armchairNook()
  nook.position.set(-1.85, 0, -3.85)
  nook.rotation.y = Math.PI / 4
  if (LITE) nook.traverse((o) => { if (o.isPointLight) o.intensity = 0 })   // glow stays, light cost goes
  scene.add(nook)
  const doorPlant = buildPlant(1.6, 'monstera')
  doorPlant.position.set(1.95, 0, -4.15)
  scene.add(doorPlant)

  // ---- walk reticle ----
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.19, 40),
    new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: 0, depthWrite: false })
  )
  reticle.rotation.x = -Math.PI / 2
  reticle.position.y = 0.02
  scene.add(reticle)
}

let caseTex = null
function caseTextures() {
  if (!caseTex) {
    caseTex = {
      wood: canvasTex(shelfWoodTexture()),
      woodR: dataTex(shelfWoodRoughnessTexture()),
      slab: canvasTex(spineRowTexture()),
      mat: null,
    }
    caseTex.slab.wrapS = THREE.RepeatWrapping
    caseTex.mat = std({ map: caseTex.wood, roughnessMap: caseTex.woodR, roughness: 1 })
  }
  return caseTex
}

// A slice of the packed-spine row texture, sized to a given front width in meters.
function spineSliceMat(widthM, seed) {
  const t = caseTextures().slab.clone()
  t.repeat.set(widthM / 1.04, 1)
  t.offset.x = (seed % 89) / 100
  t.needsUpdate = true
  return std({ map: t, roughness: 0.65 })
}

// Floor-to-ceiling case: frame + boards at BOARD_TOPS; slabRows lists the boards
// that get a packed spine-row slab sitting ON them (allDecor = every board).
function buildCase(caseW, opts = {}) {
  const g = new THREE.Group()
  const mat = caseTextures().mat
  const side = new THREE.BoxGeometry(0.08, CASE_H, CASE_D)
  const l = new THREE.Mesh(side, mat); l.position.set(-caseW / 2 + 0.04, CASE_H / 2, 0)
  const r = new THREE.Mesh(side, mat); r.position.set(caseW / 2 - 0.04, CASE_H / 2, 0)
  const top = new THREE.Mesh(new THREE.BoxGeometry(caseW + 0.06, 0.07, CASE_D + 0.04), mat); top.position.set(0, CASE_H + 0.035, 0)
  const base = new THREE.Mesh(new THREE.BoxGeometry(caseW + 0.03, 0.12, CASE_D + 0.02), mat); base.position.set(0, 0.06, 0)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(caseW - 0.08, CASE_H - 0.08), std({ color: '#3d2a18', roughness: 0.8 }))
  back.position.set(0, CASE_H / 2, -CASE_D / 2 + 0.012)
  g.add(l, r, top, base, back)

  const shelfGeo = new THREE.BoxGeometry(caseW - 0.1, 0.04, CASE_D - 0.03)
  for (const t of BOARD_TOPS) {
    const s = new THREE.Mesh(shelfGeo, mat); s.position.set(0, t - 0.02, 0); g.add(s)
  }

  const slabRows = opts.allDecor ? BOARD_TOPS : (opts.slabRows || [BOARD_TOPS[0], BOARD_TOPS[4]])
  const darkMat = std({ color: '#241a10', roughness: 0.8 })
  let seed = Math.floor(caseW * 631)
  for (const t of slabRows) {
    seed = (seed * 37 + 11) % 997
    const slab = new THREE.Mesh(
      frontBoxGeo(caseW - 0.18, SLAB_H, 0.2),
      [darkMat, spineSliceMat(caseW - 0.18, seed)]
    )
    slab.position.set(0, t + 0.132, -0.03)
    g.add(slab)
  }
  const shadow = contactShadow(caseW + 0.35, CASE_D + 0.55, 0.4)
  g.add(shadow)
  return g
}

function placeBooks(data) {
  const pagesT = canvasTex(drawPagesTexture())
  const bookGeo = new THREE.BoxGeometry(BOOK.w, BOOK.h, BOOK.d)
  const darkMat = std({ color: '#241a10', roughness: 0.8 })

  // narrow aisle layout: BA left, TP + RM right, LS + WM on the rear wall
  const CASES = {
    'Business Advisory': { pos: new THREE.Vector3(-ROOM.w / 2 + CASE_D / 2 + 0.01, 0, -1.0), ry: Math.PI / 2, w: 2.5 },
    'Tax Planning': { pos: new THREE.Vector3(ROOM.w / 2 - CASE_D / 2 - 0.01, 0, -1.0), ry: -Math.PI / 2, w: 2.5 },
    'Risk Mitigation': { pos: new THREE.Vector3(ROOM.w / 2 - CASE_D / 2 - 0.01, 0, 2.35), ry: -Math.PI / 2, w: 2.3 },
    'Legal Services': { pos: new THREE.Vector3(-1.38, 0, ROOM.d / 2 - CASE_D / 2 - 0.01), ry: Math.PI, w: 1.55 },
    'Wealth Management': { pos: new THREE.Vector3(1.38, 0, ROOM.d / 2 - CASE_D / 2 - 0.01), ry: Math.PI, w: 1.55 },
  }

  const pending = []
  ECOSYSTEMS.forEach((eco, ecoIdx) => {
    const def = CASES[eco]
    const specs = data.byEcosystem[eco] || []
    const unit = buildCase(def.w, { slabRows: [BOARD_TOPS[0], BOARD_TOPS[4]] })
    unit.position.copy(def.pos)
    unit.rotation.y = def.ry
    scene.add(unit)

    // header board + a plant on top
    const headerTex = canvasTex(caseHeaderTexture(eco, specs.length + (specs.length === 1 ? ' specialist' : ' specialists')))
    const headerW = Math.min(def.w - 0.2, 1.7)
    const header = new THREE.Mesh(new THREE.PlaneGeometry(headerW, headerW * 0.15), std({ map: headerTex, roughness: 0.6 }))
    header.position.set(0, CASE_H - 0.24, CASE_D / 2 + 0.03)
    unit.add(header)
    const topper = buildPlant(0.5 + ((hash32(ecoIdx, 5) % 30) / 100), hash32(ecoIdx, 3) % 2 ? 'fern' : 'monstera')
    topper.position.set((((hash32(ecoIdx, 9) % 100) / 100) - 0.5) * (def.w * 0.5), CASE_H + 0.07, 0)
    unit.add(topper)
    if (hash32(ecoIdx, 13) % 2) {
      const topStack = buildBookStack(2 + (hash32(ecoIdx, 17) % 3))
      topStack.position.set(-(((hash32(ecoIdx, 9) % 100) / 100) - 0.5) * (def.w * 0.4), CASE_H + 0.07, 0)
      topStack.rotation.y = (hash32(ecoIdx, 19) % 10) / 10
      unit.add(topStack)
    }

    // scattered placement: hash-seeded slot per specialist (stable as the roster grows),
    // remaining display slots filled with small spine blocks so rows read stocked.
    const perRow = Math.max(3, Math.floor((def.w - 0.25) / 0.252))
    const pitchX = (def.w - 0.25) / perRow
    const capacity = DISPLAY_BOARDS.length * perRow
    const x0 = -((perRow - 1) * pitchX) / 2
    const occupied = new Array(capacity).fill(false)

    specs.forEach((spec) => {
      const h = hash32(spec.id, ecoIdx + 1)
      let slot = h % capacity
      let guard = 0
      while (occupied[slot] && guard++ < capacity) slot = (slot + 7) % capacity
      occupied[slot] = true
      const row = Math.floor(slot / perRow)
      const col = slot % perRow
      const jitter = (((h >>> 8) % 9) - 4) * 0.004

      const texKey = spec.id + '|' + eco
      let cached = texCache.get(texKey)
      if (!cached) {
        cached = { spine: canvasTex(drawSpine(spec, eco)), front: null, frontHi: null, back: null }
        texCache.set(texKey, cached)
      }
      const mats = [
        std({ map: pagesT, roughness: 0.7 }),
        std({ map: cached.spine, roughness: 0.55 }),
        std({ map: pagesT, roughness: 0.7 }),
        std({ map: pagesT, roughness: 0.7 }),
        std({ color: ECO_COLORS[eco] || '#0b4bad', roughness: 0.55 }),
        std({ color: '#efe6d2', roughness: 0.7 }),
      ]
      const mesh = new THREE.Mesh(bookGeo, mats)
      const group = new THREE.Group()
      group.add(mesh)
      mesh.rotation.x = -0.07
      group.position.set(x0 + col * pitchX + jitter, bookY(DISPLAY_BOARDS[row]), CASE_D / 2 - 0.075)
      unit.add(group)
      mesh.userData = { spec, eco, group }
      books.push(mesh)
      pending.push({ spec, eco, cached, mesh })
    })

    // spine blocks fill runs of free slots (≤3 wide, hash-decided ~72% of runs, so gaps
    // stay scattered and stable) — one merged mesh per run keeps draw calls low
    for (let row = 0; row < DISPLAY_BOARDS.length; row++) {
      let col = 0
      while (col < perRow) {
        if (occupied[row * perRow + col]) { col++; continue }
        let len = 1
        while (col + len < perRow && !occupied[row * perRow + col + len] && len < 3) len++
        const hb = hash32((row * perRow + col) * 131 + ecoIdx * 977, 0xB00C)
        if (hb % 100 < 72) {
          const w = pitchX * len - 0.02
          const block = new THREE.Mesh(frontBoxGeo(w, SLAB_H, 0.19), [darkMat, spineSliceMat(w, hb)])
          block.position.set(x0 + (col + (len - 1) / 2) * pitchX, DISPLAY_BOARDS[row] + 0.132, CASE_D / 2 - 0.11)
          unit.add(block)
        }
        col += len
      }
    }
  })

  // decorative spine-filled cases: left wall past Business Advisory + rear-wall center gap
  const decor = buildCase(2.1, { allDecor: true })
  decor.position.set(-ROOM.w / 2 + CASE_D / 2 + 0.01, 0, 2.35)
  decor.rotation.y = Math.PI / 2
  scene.add(decor)
  const rearDecor = buildCase(1.15, { allDecor: true })
  rearDecor.position.set(0, 0, ROOM.d / 2 - CASE_D / 2 - 0.01)
  rearDecor.rotation.y = Math.PI
  scene.add(rearDecor)
  const decorPlant = buildPlant(0.85, 'fern')
  decorPlant.position.set(-ROOM.w / 2 + CASE_D / 2 + 0.01, CASE_H + 0.07, 2.35)
  scene.add(decorPlant)

  // rolling ladder leaning on the free wall strip between Tax Planning and Risk Mitigation
  const ladder = buildRollingLadder()
  ladder.position.set(ROOM.w / 2 - 0.42, 0, 0.72)
  ladder.rotation.y = -Math.PI / 2
  scene.add(ladder)

  // hydrate front covers progressively — one draw per (specialist, section) placement, so a
  // dual-ecosystem specialist gets a DIFFERENT-colored book in each section. Throttled to two
  // lanes with breathing room: canvas drawing + GPU texture upload in an uncontrolled burst is
  // exactly what causes walk-around hitches on integrated GPUs.
  let done = 0
  const total = pending.length
  const queue = [...pending]
  const pump = () => {
    const item = queue.shift()
    if (!item) return
    const { spec, eco, cached, mesh } = item
    // full 2x art straight onto the shelf — the faces are the product; the same texture
    // serves the picked-up view, so it costs nothing extra there
    drawFrontCover(spec, eco, 2).then((canvas) => {
      cached.frontHi = canvasTex(canvas)
      renderer.initTexture(cached.frontHi)            // upload NOW, in this controlled slot
      mesh.material[4] = std({ map: cached.frontHi, roughness: 0.55 })
      invalidate()
    }).catch(() => {}).finally(() => {
      done++
      if (state === 'loading') progress(45 + (done / total) * 50, 'Stocking the shelves')
      setTimeout(pump, 70)
    })
  }
  pump()
  setTimeout(pump, 35)
}

// ---------- inspect flow ----------
// Hi-res faces + the native-res bump happen AFTER the flight animation lands: canvas
// drawing and buffer reallocation mid-tween made the pickup feel sluggish.
async function hiResSwap(mesh, spec, eco) {
  const cached = texCache.get(spec.id + '|' + eco)
  try {
    // front is usually already the shelf's 2x texture; draw it only if this book was
    // picked before hydration reached it
    if (!cached.frontHi) {
      cached.frontHi = canvasTex(await drawFrontCover(spec, eco, 2))
      renderer.initTexture(cached.frontHi)
      if (held && held.mesh === mesh) mesh.material[4] = std({ map: cached.frontHi, roughness: 0.55 })
    }
    if (!cached.back) { cached.back = canvasTex(await drawBackCover(spec, eco, 2)); renderer.initTexture(cached.back) }
    if (held && held.mesh === mesh) {
      mesh.material[5] = std({ map: cached.back, roughness: 0.6 })
      invalidate()
    }
  } catch { /* cover art failure is cosmetic — the Read panel still works */ }
}

function pickUp(mesh) {
  if (held || mesh.userData.returning) return
  const group = mesh.userData.group
  const home = { parent: group.parent, pos: group.position.clone(), quat: group.quaternion.clone() }
  held = { mesh, group, home, spec: mesh.userData.spec, eco: mesh.userData.eco }
  setState('inspect')
  inspectHolder.attach(group)
  // 1.35x while held — cover text must be READABLE, that's the whole point of the shop
  tween(group, {
    pos: new THREE.Vector3(0, 0, 0), quat: new THREE.Quaternion(), scale: new THREE.Vector3(1.35, 1.35, 1.35), dur: D(0.55),
    onDone: () => {
      if (!held || held.mesh !== mesh) return
      applyRenderScale()                                // book is in hand and static: go native res
      hiResSwap(mesh, held.spec, held.eco)
    },
  })
  tween(mesh, { quat: new THREE.Quaternion(), dur: D(0.55) })   // undo the shelf lean
}

const LEAN_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.07, 0, 0))

function putBack() {
  if (!held) return
  const { group, home, mesh } = held
  closeReadPanel()
  home.parent.attach(group)
  mesh.userData.returning = true
  tween(group, {
    pos: home.pos, quat: home.quat, scale: new THREE.Vector3(1, 1, 1), dur: D(0.5),
    onDone: () => { mesh.userData.returning = false },
  })
  tween(mesh, { quat: LEAN_Q, dur: D(0.5) })
  held = null
  setState('walk')
}

// Instant version for context switches (list view) — no tween to interrupt.
function snapBack() {
  if (!held) return
  const { group, home, mesh } = held
  closeReadPanel()
  home.parent.attach(group)
  group.position.copy(home.pos)
  group.quaternion.copy(home.quat)
  group.scale.set(1, 1, 1)
  mesh.quaternion.copy(LEAN_Q)
  mesh.userData.returning = false
  held = null
  invalidate()
}

function flipHeld() {
  if (!held) return
  const q = held.group.quaternion.clone()
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
  tween(held.group, { pos: new THREE.Vector3(0, 0, 0), quat: q.multiply(flip), dur: D(0.45) })
}

function openReadPanel() {
  if (!held) return
  const { spec } = held
  $('read-title').textContent = spec.name
  $('read-tagline').textContent = spec.shortBio || ''
  const chips = $('read-chips')
  chips.textContent = ''
  for (const cat of spec.categories) {
    const s = document.createElement('span')
    s.textContent = cat
    s.style.background = ECO_COLORS[cat] || '#0b4bad'
    chips.appendChild(s)
  }
  $('read-body').textContent = (spec.longBio || spec.shortBio || '').replace(/\r\n/g, '\n')
  $('read-panel').classList.remove('vs-hidden')
  $('btn-read-close').focus()
}

function closeReadPanel() { $('read-panel').classList.add('vs-hidden') }

// ---------- input ----------
function bindInput() {
  const canvas = renderer.domElement

  canvas.addEventListener('pointerdown', (e) => {
    pointer.down = true; pointer.id = e.pointerId
    pointer.sx = pointer.x = e.clientX; pointer.sy = pointer.y = e.clientY
    pointer.moved = 0; pointer.t = performance.now()
    try { canvas.setPointerCapture(e.pointerId) } catch { /* synthetic or already-released pointers */ }
  })

  canvas.addEventListener('pointermove', (e) => {
    if (pointer.down && e.pointerId === pointer.id) {
      const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y
      pointer.x = e.clientX; pointer.y = e.clientY
      pointer.moved += Math.abs(dx) + Math.abs(dy)
      if (state === 'walk') {
        yaw -= dx * 0.0042
        pitch = Math.max(-0.65, Math.min(0.65, pitch - dy * 0.0042))
        camera.rotation.set(pitch, yaw, 0)
        invalidate()
      } else if (state === 'inspect' && held) {
        const g = held.group
        g.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dx * 0.008)
        g.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), dy * 0.006)
        invalidate()
      }
    } else if (state === 'walk') {
      hoverPending = { x: e.clientX, y: e.clientY }   // raycast once per FRAME, not per mouse event
    }
  })

  canvas.addEventListener('pointerup', (e) => {
    if (!pointer.down || e.pointerId !== pointer.id) return
    pointer.down = false
    const wasClick = pointer.moved < 8 && performance.now() - pointer.t < 450
    if (!wasClick) return
    handleClick(e.clientX, e.clientY)
  })

  canvas.addEventListener('pointercancel', () => { pointer.down = false })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('read-panel').classList.contains('vs-hidden')) { closeReadPanel(); return }
      if (state === 'inspect') putBack()
      return
    }
    if (state !== 'walk') return
    keys.add(e.key.toLowerCase())
    invalidate()
  })
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

  const applyViewport = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.fov = camera.aspect < 0.75 ? 76 : 64        // portrait phones need a wider view
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(targetRatio())
    renderer.setSize(window.innerWidth, window.innerHeight)
    invalidate()
  }
  applyViewport()
  window.addEventListener('resize', () => { if (renderer) applyViewport() })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop()
    else if (entered && state !== 'list') startLoop()
  })

  // HUD + panels
  $('btn-flip').addEventListener('click', flipHeld)
  $('btn-read').addEventListener('click', openReadPanel)
  $('btn-back').addEventListener('click', putBack)
  $('btn-read-close').addEventListener('click', closeReadPanel)
  $('read-scrim').addEventListener('click', closeReadPanel)
  $('btn-list').addEventListener('click', openList)
  $('btn-store').addEventListener('click', closeList)

  const fsBtn = $('btn-fs')
  if (document.documentElement.requestFullscreen) {
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen().catch(() => {})
    })
    document.addEventListener('fullscreenchange', () => {
      fsBtn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'
    })
  } else {
    fsBtn.classList.add('vs-hidden')
  }
}

const _ndc = new THREE.Vector2()
function ndcFrom(cx, cy) {
  return _ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1)
}

function firstPickable(hits) {
  for (const h of hits) if (!h.object.userData.returning) return h.object
  return null
}

function updateHover(cx, cy) {
  raycaster.setFromCamera(ndcFrom(cx, cy), camera)
  const target = firstPickable(raycaster.intersectObjects(books, false))
  if (target !== hovered) {
    if (hovered) tween(hovered.userData.group, { scale: new THREE.Vector3(1, 1, 1), dur: D(0.18) })
    hovered = target
    if (hovered) tween(hovered.userData.group, { scale: new THREE.Vector3(1.06, 1.06, 1.06), dur: D(0.18) })
    renderer.domElement.style.cursor = hovered ? 'pointer' : ''
    invalidate()
  }
}

function handleClick(cx, cy) {
  raycaster.setFromCamera(ndcFrom(cx, cy), camera)
  if (state === 'inspect') {
    if (held && raycaster.intersectObject(held.mesh, false).length) { flipHeld(); return }
    putBack()
    return
  }
  if (state !== 'walk') return
  const bookTarget = firstPickable(raycaster.intersectObjects(books, false))
  if (bookTarget) {
    if (hovered) { tween(hovered.userData.group, { scale: new THREE.Vector3(1, 1, 1), dur: D(0.12) }); hovered = null }
    renderer.domElement.style.cursor = ''
    pickUp(bookTarget)
    return
  }
  const floorHit = raycaster.intersectObject(floorMesh, false)[0]
  if (floorHit) {
    glideTarget = new THREE.Vector3(
      Math.max(WALK_BOUNDS.minX, Math.min(WALK_BOUNDS.maxX, floorHit.point.x)),
      EYE,
      Math.max(WALK_BOUNDS.minZ, Math.min(WALK_BOUNDS.maxZ, floorHit.point.z))
    )
    reticle.position.set(glideTarget.x, 0.02, glideTarget.z)
    reticle.material.opacity = 0.9
    invalidate()
  }
}

// scratch vectors — the movement path runs every frame; allocating there causes GC hitches
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _wish = new THREE.Vector3(), _to = new THREE.Vector3()

function stepMovement(dt) {
  if (state !== 'walk') return
  let moved = false
  const speed = 2.1
  _fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw))
  _right.set(-_fwd.z, 0, _fwd.x)
  _wish.set(0, 0, 0)
  if (keys.has('w') || keys.has('arrowup')) _wish.add(_fwd)
  if (keys.has('s') || keys.has('arrowdown')) _wish.sub(_fwd)
  if (keys.has('d') || keys.has('arrowright')) _wish.add(_right)
  if (keys.has('a') || keys.has('arrowleft')) _wish.sub(_right)
  if (_wish.lengthSq() > 0) {
    glideTarget = null
    reticle.material.opacity = 0
    _wish.normalize().multiplyScalar(speed * dt)
    camera.position.add(_wish)
    moved = true
  } else if (glideTarget) {
    const to = _to.copy(glideTarget).sub(camera.position); to.y = 0
    const dist = to.length()
    if (dist < 0.06) {
      glideTarget = null
    } else {
      to.normalize().multiplyScalar(Math.min(dist, speed * dt))
      camera.position.add(to)
    }
    reticle.material.opacity = Math.max(0, reticle.material.opacity - dt * 0.5)
    moved = true
  }
  if (moved) {
    camera.position.x = Math.max(WALK_BOUNDS.minX, Math.min(WALK_BOUNDS.maxX, camera.position.x))
    camera.position.z = Math.max(WALK_BOUNDS.minZ, Math.min(WALK_BOUNDS.maxZ, camera.position.z))
    camera.position.y = EYE
    invalidate()
  }
}

// ---------- debug overlay (?debug=1): the page reports its own renderer + pacing ----------
let dbgEl = null, dbgRenders = 0, dbgWorst = 0, dbgStamp = 0
function debugTick(t, renderedGap) {
  if (!DEBUG) return
  if (!dbgEl) {
    dbgEl = document.createElement('div')
    dbgEl.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99;background:rgba(0,20,50,.85);color:#e8dcc0;font:11px monospace;padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre'
    document.body.appendChild(dbgEl)
    dbgStamp = t
  }
  if (renderedGap != null) { dbgRenders++; if (renderedGap > dbgWorst) dbgWorst = renderedGap }
  if (t - dbgStamp >= 1000) {
    const c = renderer.domElement
    dbgEl.textContent =
      `${gpuString}\n` +
      `profile ${SOFTWARE ? 'SOFTWARE (hw accel OFF!)' : LITE ? 'LITE' : 'FULL'} | buf ${c.width}x${c.height} | win ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x\n` +
      `renders/s ${dbgRenders} | worst gap ${dbgWorst.toFixed(0)}ms | state ${state}`
    dbgRenders = 0; dbgWorst = 0; dbgStamp = t
  }
}

// ---------- render loop ----------
// Renders are gated to ~72fps max: on 144Hz panels an every-other-vsync cadence is
// perfectly even, where "as fast as possible" flaps between rates and reads as stutter.
const RENDER_GATE_MS = 13
let lastT = 0, lastRenderT = 0, wasRendering = false, slowStreak = 0
function loop(t) {
  rafId = requestAnimationFrame(loop)
  const dt = Math.min((t - lastT) / 1000 || 0.016, 0.05)
  lastT = t
  stepMovement(dt)
  stepTweens(dt)
  if (hoverPending && state === 'walk') { updateHover(hoverPending.x, hoverPending.y); hoverPending = null }
  debugTick(t, null)
  if (needRender && t - lastRenderT >= RENDER_GATE_MS) {
    needRender = false
    const gap = t - lastRenderT
    lastRenderT = t
    renderer.render(scene, camera)
    debugTick(t, wasRendering ? gap : null)   // only continuous frames — idle gaps aren't stutter
    // adaptive quality: sustained slow CONSECUTIVE rendered frames -> step resolution down
    if (wasRendering && gap > 24) slowStreak++
    else slowStreak = Math.max(0, slowStreak - 2)
    wasRendering = true
    if (slowStreak > 60 && dprCap > 0.7) {
      dprCap -= 0.15
      slowStreak = 0
      renderer.setPixelRatio(targetRatio())
      renderer.setSize(window.innerWidth, window.innerHeight)
      invalidate()
    }
  } else if (!needRender) {
    wasRendering = false
  }
}
function startLoop() { if (!running) { running = true; lastT = performance.now(); invalidate(); rafId = requestAnimationFrame(loop) } }
function stopLoop() { running = false; cancelAnimationFrame(rafId) }

// ---------- list view ----------
function openList() {
  if (!listApi) return
  snapBack()                                          // never leave a held book hanging mid-air
  setState('list')
  stopLoop()
  $('list-view').classList.remove('vs-hidden')
  $('hud').classList.add('vs-hidden')
  listApi.show()
  document.body.style.overflow = ''
}
function closeList() {
  if (!webglOK) return
  listApi.hide()
  $('list-view').classList.add('vs-hidden')
  if (!entered) { $('enter-overlay').classList.remove('vs-hidden'); setState('enter'); return }
  $('hud').classList.remove('vs-hidden')
  setState('walk')
  startLoop()
}

// ---------- boot ----------
function progress(pct, copy) {
  $('load-bar').style.width = Math.min(100, pct).toFixed(0) + '%'
  if (copy) $('load-copy').textContent = copy
}

function fatal(msg) {
  stopLoop()
  $('loading-screen').classList.add('vs-hidden')
  $('enter-overlay').classList.add('vs-hidden')
  $('err-copy').textContent = msg
  $('err-screen').classList.remove('vs-hidden')
}

async function main() {
  $('btn-retry').addEventListener('click', () => location.reload())
  progress(6, 'Opening the shop')

  let data
  try {
    data = await loadSpecialists()
  } catch (err) {
    fatal(err && err.message ? err.message : 'We could not load the shelves. Please try again.')
    return
  }
  progress(22, 'Warming the lamps')
  try { await ensureFonts() } catch { /* fonts are progressive enhancement */ }

  // 2D list is built either way — it's the fallback and the accessibility path
  try {
    listApi = await initListView($('list-host'), { data })
  } catch { listApi = null }

  try {
    buildRenderer()
  } catch {
    webglOK = false
    $('btn-store').classList.add('vs-hidden')
    $('loading-screen').classList.add('vs-hidden')
    if (listApi) { setState('list'); $('list-view').classList.remove('vs-hidden'); listApi.show() }
    else fatal('This device could not start the 3D store, and the list view failed to load.')
    return
  }

  progress(38, 'Building the shelves')
  buildScene()
  placeBooks(data)
  bindInput()

  progress(97, 'Nearly there')
  renderer.render(scene, camera)

  $('loading-screen').classList.add('vs-hidden')
  $('enter-overlay').classList.remove('vs-hidden')
  setState('enter')

  $('btn-enter').addEventListener('click', () => {
    entered = true
    $('enter-overlay').classList.add('vs-hidden')
    $('hud').classList.remove('vs-hidden')
    setState('walk')
    startLoop()
  })
  $('btn-list-from-enter').addEventListener('click', () => {
    $('enter-overlay').classList.add('vs-hidden')
    openList()
  })
}

main()
