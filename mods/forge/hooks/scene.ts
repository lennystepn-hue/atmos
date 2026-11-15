// The Forge scene: a smithy fire, drawn from how hot it is and what Claude is doing.

import { along, frame, num, rng, track } from './kit'
import type { ForgeView, Scheme } from '../types'

/** The fire's five levels, coldest first. */
export const LEVELS = ['Cold', 'Embers', 'Burning', 'Roaring', 'White-hot'] as const

/** Heat, 0 to 100, as one of the five levels. */
export function levelOf(heat: number): number {
  if (heat <= 0) {
    return 0
  }

  if (heat <= 25) {
    return 1
  }

  if (heat <= 60) {
    return 2
  }

  return heat <= 88 ? 3 : 4
}

const NIGHT = {
  bg0: '#1c130f',
  bg1: '#120c09',
  bg2: '#070403',
  sil: '#040201',
  coal: '#160d09',
  glow: '#ff6a1c',
  f1: '#e8421a',
  f2: '#ff8a1e',
  f3: '#ffd76a',
  spark: '#ffc45c',
  smoke: '#8a7f78',
  steam: '#efe9e3',
}

const DAY = {
  bg0: '#f7ecde',
  bg1: '#eddac4',
  bg2: '#dcc0a2',
  sil: '#4e382b',
  coal: '#3a2a21',
  glow: '#ff7a2a',
  f1: '#e8501f',
  f2: '#ff9326',
  f3: '#ffe08a',
  spark: '#e96f14',
  smoke: '#a89a8e',
  steam: '#ffffff',
}

// White-hot: the same fire, burning paler.
const WHITE_HOT = { f1: '#ff6a1e', f2: '#ffb23e', f3: '#fff1c9' }

const CSS = [
  '.fp{transform-box:fill-box;transform-origin:center;animation:fp var(--d) ease-out infinite}',
  '@keyframes fp{0%{transform:translate(0,0) scale(1);opacity:0}8%{opacity:1}70%{opacity:.9}100%{transform:translate(var(--x),var(--y)) scale(.08);opacity:0}}',
  '.em{animation:ember var(--d) ease-in-out infinite alternate}',
  '@keyframes ember{from{opacity:.25}to{opacity:1}}',
  '.sp{fill:var(--spark);transform-box:fill-box;transform-origin:center;animation:spark var(--d) ease-out infinite}',
  '@keyframes spark{0%{transform:translate(0,0);opacity:0}8%{opacity:1}65%{opacity:.85}100%{transform:translate(var(--x),var(--y));opacity:0}}',
  '.sm,.steam{transform-box:fill-box;transform-origin:center}',
  '.sm{animation:smoke var(--d) ease-out infinite}',
  '@keyframes smoke{0%{transform:translate(0,0) scale(.5);opacity:0}20%{opacity:.5}100%{transform:translate(var(--x),-760px) scale(2.6);opacity:0}}',
  '.hg{animation:hang var(--d) ease-in-out infinite alternate}',
  '@keyframes hang{from{transform:rotate(-2.2deg)}to{transform:rotate(2.2deg)}}',
  '.breath{animation:breath 12s ease-in-out infinite alternate}',
  '@keyframes breath{from{opacity:.62}to{opacity:.8}}',
  '.hit{animation:hit var(--d) ease-out infinite}',
  '@keyframes hit{0%{transform:translate(0,0) scale(.4);opacity:0}6%{opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1);opacity:0}}',
  '.m-done .burst{animation:hit var(--d) ease-out var(--w) 1 both}',
  '.m-done .steam{animation:steam var(--d) ease-out var(--w) 1 both}',
  '@keyframes steam{0%{transform:translate(0,0) scale(.4);opacity:0}15%{opacity:.6}100%{transform:translate(var(--x),-640px) scale(3.2);opacity:0}}',
].join('')

const DEFS =
  '<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" style="stop-color:var(--bg0)"/><stop offset=".6" style="stop-color:var(--bg1)"/>' +
  '<stop offset="1" style="stop-color:var(--bg2)"/></linearGradient>' +
  '<radialGradient id="heat"><stop offset="0" style="stop-color:var(--f3);stop-opacity:.95"/>' +
  '<stop offset=".3" style="stop-color:var(--glow);stop-opacity:.55"/>' +
  '<stop offset="1" style="stop-color:var(--glow);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="ember"><stop offset="0" style="stop-color:var(--f3)"/>' +
  '<stop offset=".4" style="stop-color:var(--f2);stop-opacity:.8"/>' +
  '<stop offset="1" style="stop-color:var(--f1);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="fp"><stop offset="0" style="stop-color:var(--f3);stop-opacity:.78"/>' +
  '<stop offset=".5" style="stop-color:var(--f2);stop-opacity:.42"/>' +
  '<stop offset="1" style="stop-color:var(--f1);stop-opacity:0"/></radialGradient>' +
  // Fire is drawn as heat: the puffs blur into one field, and how dense the field is
  // picks the color, from a dark red edge through orange to a pale yellow core.
  '<filter id="fire" filterUnits="userSpaceOnUse" x="-20" y="360" width="1640" height="660" color-interpolation-filters="sRGB">' +
  '<feGaussianBlur stdDeviation="12"/>' +
  '<feColorMatrix type="matrix" values="0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0"/>' +
  '<feComponentTransfer><feFuncR type="table" tableValues="0.62 0.95 1 1 1 1"/>' +
  '<feFuncG type="table" tableValues="0.05 0.2 0.48 0.76 0.93 1"/>' +
  '<feFuncB type="table" tableValues="0 0 0.05 0.18 0.5 0.86"/>' +
  '<feFuncA type="table" tableValues="0 0.08 0.8 1 1 1"/></feComponentTransfer></filter>' +
  '<radialGradient id="puff"><stop offset="0" style="stop-color:var(--smoke);stop-opacity:.6"/>' +
  '<stop offset="1" style="stop-color:var(--smoke);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="mist"><stop offset="0" style="stop-color:var(--steam);stop-opacity:.75"/>' +
  '<stop offset="1" style="stop-color:var(--steam);stop-opacity:0"/></radialGradient>'

// How bright a puff, a spark and a wisp of smoke are along their way up, as their keyframes have it.
const FLAME_FADE = [[0, 0], [0.08, 1], [0.7, 0.9], [1, 0]] as const
const SPARK_FADE = [[0, 0], [0.08, 1], [0.65, 0.85], [1, 0]] as const
const SMOKE_FADE = [[0, 0], [0.2, 0.5], [1, 0]] as const
const STRIKE_FADE = [[0, 0], [0.06, 1], [1, 0]] as const

/** The fire: puffs of heat that rise from the coals in tongues, shrinking as they climb. */
function flames(level: number): string {
  const count = [0, 0, 150, 230, 310][level] ?? 0
  const reach = [0, 0, 250, 360, 470][level] ?? 0
  const random = rng(13)
  // A fire burns in tongues: each has its place on the hearth and its own height.
  const tongues: { x: number; strength: number }[] = []

  for (let index = 0; index < 15; index += 1) {
    tongues.push({ x: 60 + ((index + 0.5) / 15) * 1480 + (random() - 0.5) * 70, strength: 0.55 + random() * 0.6 })
  }
  let out = ''

  for (let index = 0; index < count; index += 1) {
    const tongue = tongues[index % tongues.length] ?? { x: 800, strength: 1 }
    const spread = (random() + random() - 1) * 34
    const duration = 0.9 + random() * 1.1
    const offset = random() * duration
    const sway = -30 + random() * 60
    const rise = -reach * tongue.strength * (0.5 + random() * 0.6)
    const rest = along(offset, duration)
    out +=
      `<circle class="fp s" cx="${num(tongue.x + spread)}" cy="${num(962 + random() * 22)}" r="${num(34 + random() * 30)}" fill="url(#fp)" ` +
      `opacity="${num(track(rest, FLAME_FADE), 2)}" ` +
      `transform="translate(${num(sway * rest)} ${num(rise * rest)}) scale(${num(1 - 0.92 * rest, 2)})" ` +
      `style="--d:${num(duration, 2)}s;--o:${num(offset, 2)};--x:${num(sway)}px;--y:${num(rise)}px"/>`
  }

  return count === 0 ? '' : `<g filter="url(#fire)">${out}</g>`
}

function coals(level: number): string {
  const random = rng(29)
  let path = 'M0 1000V952'

  for (let x = 70; x <= 1600; x += 70) {
    path += `Q${x - 35} ${num(918 + random() * 30)} ${x} ${num(940 + random() * 26)}`
  }
  let glowing = ''

  for (let index = 0; index < (level === 0 ? 0 : 26); index += 1) {
    glowing +=
      `<ellipse class="em s" cx="${num(40 + random() * 1520)}" cy="${num(952 + random() * 34)}" ` +
      `rx="${num(22 + random() * 46)}" ry="${num(9 + random() * 12)}" fill="url(#ember)" ` +
      `style="--d:${num(1.4 + random() * 2.6, 2)}s;--o:${num(random() * 5, 2)}"/>`
  }

  return `<path d="${path}V1000Z" style="fill:var(--coal)"/>${glowing}`
}

function sparks(level: number): string {
  const count = [0, 12, 30, 48, 72][level] ?? 0
  const random = rng(53)
  let out = ''

  for (let index = 0; index < count; index += 1) {
    const duration = 3.2 + random() * 6
    const offset = random() * duration
    const dx = -150 + random() * 300
    const dy = -260 - random() * 620
    const rest = along(offset, duration)
    out +=
      `<circle class="sp s" cx="${num(40 + random() * 1520)}" cy="${num(900 + random() * 60)}" r="${num(1.4 + random() * 2.6)}" ` +
      `opacity="${num(track(rest, SPARK_FADE), 2)}" transform="translate(${num(dx * rest)} ${num(dy * rest)})" ` +
      `style="--d:${num(duration, 2)}s;--o:${num(offset, 2)};--x:${num(dx)}px;--y:${num(dy)}px"/>`
  }

  return out
}

function smoke(level: number): string {
  // A dead fire smokes; a hot one burns clean.
  const count = [9, 6, 3, 0, 0][level] ?? 0
  const random = rng(67)
  let out = ''

  for (let index = 0; index < count; index += 1) {
    const duration = 11 + random() * 9
    const offset = random() * duration
    const dx = -120 + random() * 240
    const rest = along(offset, duration)
    out +=
      `<circle class="sm s" cx="${num(160 + random() * 1280)}" cy="930" r="${num(46 + random() * 40)}" fill="url(#puff)" ` +
      `opacity="${num(track(rest, SMOKE_FADE), 2)}" ` +
      `transform="translate(${num(dx * rest)} ${num(-760 * rest)}) scale(${num(0.5 + 2.1 * rest, 2)})" ` +
      `style="--d:${num(duration, 1)}s;--o:${num(offset, 1)};--x:${num(dx)}px"/>`
  }

  return out
}

const ANVIL =
  '<g transform="translate(1404 806) scale(-1.3 1.3)" style="fill:var(--sil)">' +
  '<path d="M-120-70H60C95-70 130-62 160-46C125-40 95-36 70-34C62-10 40 8 36 30H60V60H-80V30H-56C-60 8-80-10-92-34H-120Z"/>' +
  '<path d="M-74 60H54L62 200H-82Z"/></g>'

/** Tools hung from a rail in the top left corner, swinging a little. */
function rack(): string {
  const hammer = '<path d="M-5 0H5V150H-5Z"/><path d="M-34 150H34V186H-34Z"/>'
  const tongs = '<path d="M-4 0H4L16 150C22 180 14 204 2 214L-2 214C-14 204-22 180-16 150Z"/><path d="M-2 26H2V200H-2Z" opacity=".5"/>'
  const hook = '<path d="M-4 0H4V120C4 150 30 150 30 126H22C22 140 12 140 12 120V0Z"/>'
  const hung = (x: number, long: number, shape: string, offset: number) =>
    `<g class="hg s" style="transform-origin:${x}px 30px;--d:${num(3.6 + offset, 1)}s;--o:${offset}">` +
    `<g transform="translate(${x} 30) scale(1 ${long})">${shape}</g></g>`

  return (
    '<g style="fill:var(--sil)"><path d="M0 18H420V34H0Z"/>' +
    hung(70, 1, hammer, 0.4) +
    hung(170, 1.15, tongs, 1.7) +
    hung(260, 0.9, hook, 0.9) +
    hung(350, 1.25, hammer, 2.3) +
    '</g>'
  )
}

function working(): string {
  const random = rng(101)
  let strike = ''

  // Work on the anvil: a steady spray of sparks, never a beat.
  for (let index = 0; index < 16; index += 1) {
    const duration = 1.6 + random() * 1.8
    const offset = random() * duration
    const angle = -Math.PI * (0.08 + random() * 0.84)
    const reach = 150 + random() * 260
    const dx = Math.cos(angle) * reach
    const dy = Math.sin(angle) * reach
    const rest = along(offset, duration)
    strike +=
      `<circle class="sp hit s" cx="1378" cy="712" r="${num(2 + random() * 2.6)}" opacity="${num(track(rest, STRIKE_FADE), 2)}" ` +
      `transform="translate(${num(dx * rest)} ${num(dy * rest)}) scale(${num(0.4 + 0.6 * rest, 2)})" ` +
      `style="--d:${num(duration, 2)}s;--o:${num(offset, 2)};--x:${num(dx)}px;--y:${num(dy)}px"/>`
  }

  return (
    '<g class="w">' +
    '<ellipse class="breath s" cx="800" cy="1000" rx="1050" ry="700" fill="url(#heat)" style="transform-origin:800px 1000px"/>' +
    strike +
    '</g>'
  )
}

function flourish(): string {
  const random = rng(131)
  let out = ''

  // One last blow, then the blade is quenched: steam rolls up from the trough.
  for (let index = 0; index < 30; index += 1) {
    const angle = -Math.PI * (0.04 + random() * 0.92)
    const reach = 220 + random() * 420
    out +=
      `<circle class="f sp burst" cx="1378" cy="712" r="${num(2 + random() * 3.4)}" ` +
      `style="--d:${num(1.2 + random() * 1.4, 2)}s;--w:${num(random() * 0.25, 2)}s;` +
      `--x:${num(Math.cos(angle) * reach)}px;--y:${num(Math.sin(angle) * reach)}px"/>`
  }

  for (let index = 0; index < 9; index += 1) {
    out +=
      `<circle class="f steam" cx="${num(330 + random() * 320)}" cy="950" r="${num(70 + random() * 60)}" fill="url(#mist)" ` +
      `style="--d:${num(4 + random() * 3, 1)}s;--w:${num(0.5 + random() * 1.6, 2)}s;--x:${num(-160 + random() * 200)}px"/>`
  }

  return out
}

/** The whole backdrop as one SVG document. The same view always gives the same string. */
export function drawScene(view: ForgeView, scheme: Scheme): string {
  const level = Math.min(4, Math.max(0, Math.round(view.heat)))
  const hot = level === 4 ? WHITE_HOT : {}
  const glow = [0, 0.3, 0.55, 0.8, 1][level] ?? 0
  const body =
    '<rect width="1600" height="1000" fill="url(#wall)"/>' +
    `<ellipse cx="800" cy="1000" rx="1050" ry="${num(240 + level * 105)}" fill="url(#heat)" opacity="${glow}"/>` +
    rack() +
    smoke(level) +
    flames(level) +
    coals(level) +
    sparks(level) +
    ANVIL +
    (view.mood === 'idle' ? '' : working()) +
    (view.mood === 'done' ? flourish() : '')

  return frame({
    at: view.at,
    mood: view.mood,
    scheme,
    dark: { ...NIGHT, ...hot },
    light: { ...DAY, ...hot },
    css: CSS,
    defs: DEFS,
    body,
  })
}
