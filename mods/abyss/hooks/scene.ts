// The Abyss scene: one SVG, drawn from how deep the session is and what Claude is doing.

import { along, frame, num, rng } from './kit'
import type { AbyssView, Scheme } from '../types'

// ---------------------------------------------------------------------------
// Depth: the context window as an ocean
// ---------------------------------------------------------------------------

/** The five zones of the open ocean, by the depth in metres where each begins. */
export const ZONES = [
  { name: 'Sunlight zone', from: 0 },
  { name: 'Twilight zone', from: 200 },
  { name: 'Midnight zone', from: 1000 },
  { name: 'Abyssal zone', from: 4000 },
  { name: 'Hadal zone', from: 6000 },
] as const

/** The deepest point there is: a full context window. */
export const SEA_FLOOR = 11_000

/** Context used, 0 to 100, as a depth in metres. A curve, so the zones fall where the real ones do. */
export function depthOf(percent: number): number {
  const used = Math.min(100, Math.max(0, percent)) / 100

  return Math.round(SEA_FLOOR * used ** 1.6)
}

export function zoneOf(depth: number): number {
  let zone = 0

  ZONES.forEach((entry, index) => {
    if (depth >= entry.from) {
      zone = index
    }
  })

  return zone
}

// ---------------------------------------------------------------------------
// Colors: the water in each zone, by night and by day
// ---------------------------------------------------------------------------

type Water = {
  top: string
  mid: string
  bot: string
  ray: string
  rayA: number
  glow: string
  glowA: number
  dot: string
  sil: string
  jelly: string
  whale: string
}

const NIGHT: readonly Water[] = [
  { top: '#12849f', mid: '#0b527c', bot: '#062a4d', ray: '#c4f6ff', rayA: 0.26, glow: '#43e3d2', glowA: 0.12, dot: '#dcfcff', sil: '#041a31', jelly: '#9aecff', whale: '#073457' },
  { top: '#0b4c73', mid: '#07325d', bot: '#041c3c', ray: '#a5e0f7', rayA: 0.15, glow: '#37d8d2', glowA: 0.16, dot: '#c4f5ff', sil: '#031327', jelly: '#84e5ff', whale: '#0a3a5e' },
  { top: '#062945', mid: '#041b35', bot: '#020e20', ray: '#86c9ea', rayA: 0.06, glow: '#2fe8ca', glowA: 0.22, dot: '#93f7e8', sil: '#020b19', jelly: '#74f2e2', whale: '#0b3252' },
  { top: '#041527', mid: '#030d1c', bot: '#010710', ray: '#86c9ea', rayA: 0, glow: '#3af2d2', glowA: 0.28, dot: '#80ffea', sil: '#01060e', jelly: '#b890ff', whale: '#0b2a47' },
  { top: '#020913', mid: '#01060d', bot: '#000307', ray: '#86c9ea', rayA: 0, glow: '#ff62b4', glowA: 0.26, dot: '#78ffeb', sil: '#000305', jelly: '#ff7ed2', whale: '#0c2540' },
]

const DAY: readonly Water[] = [
  { top: '#e6fbf5', mid: '#b7ede7', bot: '#80d5d8', ray: '#ffffff', rayA: 0.55, glow: '#ffffff', glowA: 0.4, dot: '#ffffff', sil: '#4a9fad', jelly: '#ffffff', whale: '#58aebb' },
  { top: '#cbf2eb', mid: '#96dddd', bot: '#5ebbc8', ray: '#ffffff', rayA: 0.42, glow: '#f4fffc', glowA: 0.34, dot: '#ffffff', sil: '#34899b', jelly: '#f8fffe', whale: '#429aab' },
  { top: '#b1e5e3', mid: '#72c5d1', bot: '#4299b5', ray: '#f6ffff', rayA: 0.28, glow: '#dcfff7', glowA: 0.3, dot: '#f4ffff', sil: '#266e8a', jelly: '#ebfffc', whale: '#2f7f9c' },
  { top: '#92d4db', mid: '#58a8c1', bot: '#307aa0', ray: '#e9fcff', rayA: 0.17, glow: '#beffef', glowA: 0.28, dot: '#e3fffb', sil: '#1d587b', jelly: '#d9fff7', whale: '#25688a' },
  { top: '#77becf', mid: '#428baa', bot: '#235e88', ray: '#dbf7ff', rayA: 0.1, glow: '#a8ffe9', glowA: 0.28, dot: '#cffff5', sil: '#154367', jelly: '#ffd9f1', whale: '#1c5277' },
]

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CSS = [
  '.ray{animation:sway var(--d) ease-in-out infinite alternate}',
  '@keyframes sway{from{transform:rotate(-3.5deg)}to{transform:rotate(3.5deg)}}',
  '.surf{animation:surf 19s ease-in-out infinite alternate}',
  '@keyframes surf{from{transform:translateX(-90px)}to{transform:translateX(90px)}}',
  '.gl{transform-box:fill-box;transform-origin:center;animation:drift var(--d) ease-in-out infinite alternate}',
  '@keyframes drift{from{transform:translate(-70px,-30px) scale(.9)}to{transform:translate(80px,40px) scale(1.15)}}',
  '.p{fill:var(--dot);animation:rise var(--d) linear infinite}',
  '@keyframes rise{from{transform:translate(0,1060px)}to{transform:translate(var(--x),-60px)}}',
  '.orb{animation:tw var(--d) ease-in-out infinite alternate}',
  '@keyframes tw{from{opacity:.12;transform:translate(0,14px)}to{opacity:1;transform:translate(20px,-14px)}}',
  '.bob{animation:bob var(--d) ease-in-out infinite alternate}',
  '@keyframes bob{from{transform:translateY(-28px)}to{transform:translateY(28px)}}',
  '.pulse{transform-box:fill-box;transform-origin:50% 0;animation:pulse var(--d) ease-in-out infinite}',
  '@keyframes pulse{0%,100%{transform:scale(1,1)}45%{transform:scale(.85,1.1)}}',
  '.school{animation:swim 84s linear infinite}',
  '@keyframes swim{from{transform:translateX(-560px)}to{transform:translateX(1720px)}}',
  '.kelp{animation:kelp var(--d) ease-in-out infinite alternate}',
  '@keyframes kelp{from{transform:skewX(-6deg)}to{transform:skewX(6deg)}}',
  '.bloom{animation:bloom 14s ease-in-out infinite alternate}',
  '@keyframes bloom{from{opacity:.6}to{opacity:.78}}',
  '.m-done .whale{animation:pass 19s cubic-bezier(.35,.1,.45,1) .3s 1 both}',
  '@keyframes pass{0%{transform:translate(-640px,70px);opacity:0}10%{opacity:.62}86%{opacity:.62}100%{transform:translate(1740px,-50px);opacity:0}}',
  '.m-done .bub{animation:bub var(--d) ease-out var(--w) 1 both}',
  '@keyframes bub{0%{transform:translateY(0);opacity:0}14%{opacity:.85}100%{transform:translateY(-860px);opacity:0}}',
].join('')

const DEFS =
  '<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" style="stop-color:var(--top)"/><stop offset=".5" style="stop-color:var(--mid)"/>' +
  '<stop offset="1" style="stop-color:var(--bot)"/></linearGradient>' +
  '<linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" style="stop-color:var(--ray);stop-opacity:.95"/>' +
  '<stop offset=".82" style="stop-color:var(--ray);stop-opacity:0"/></linearGradient>' +
  '<radialGradient id="glow"><stop offset="0" style="stop-color:var(--glow);stop-opacity:.9"/>' +
  '<stop offset="1" style="stop-color:var(--glow);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="orb"><stop offset="0" style="stop-color:#fff;stop-opacity:.95"/>' +
  '<stop offset=".22" style="stop-color:var(--glow);stop-opacity:.85"/>' +
  '<stop offset="1" style="stop-color:var(--glow);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="jg"><stop offset="0" style="stop-color:var(--jelly);stop-opacity:.5"/>' +
  '<stop offset="1" style="stop-color:var(--jelly);stop-opacity:0"/></radialGradient>'

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

function glows(): string {
  const random = rng(31)
  let out = ''

  for (let index = 0; index < 5; index += 1) {
    const cx = num(120 + random() * 1360)
    const cy = num(260 + random() * 640)
    const r = num(240 + random() * 220)
    out +=
      `<circle class="gl s" cx="${cx}" cy="${cy}" r="${r}" fill="url(#glow)" ` +
      `style="--d:${num(26 + random() * 22)}s;--o:${num(random() * 40)}"/>`
  }

  return `<g style="opacity:var(--glowA)">${out}</g>`
}

function rays(): string {
  const random = rng(5)
  let out = ''

  for (let index = 0; index < 6; index += 1) {
    const x = num(90 + index * 265 + random() * 120)
    const top = num(40 + random() * 60)
    const foot = num(150 + random() * 170)
    const lean = num(-220 + random() * 160)
    out +=
      `<polygon class="ray s" points="${x - top},-60 ${x + top},-60 ${x + lean + foot},1000 ${x + lean - foot},1000" ` +
      `fill="url(#ray)" style="transform-origin:${x}px -60px;--d:${num(13 + random() * 10)}s;--o:${num(random() * 30)}"/>`
  }
  const surface =
    '<path class="surf s" d="M-120 -10H1720V34Q1500 74 1290 42T860 50T430 40T-120 58Z" style="fill:var(--ray)" opacity=".5"/>'

  return `<g style="opacity:var(--rayA)">${out}${surface}</g>`
}

function particles(count: number, seed: number, fast: boolean): string {
  const random = rng(seed)
  let out = ''

  for (let index = 0; index < count; index += 1) {
    const duration = fast ? 12 + random() * 14 : 34 + random() * 46
    const radius = fast ? 2 + random() * 3.2 : 1.2 + random() * 2.8
    const opacity = fast ? 0.55 + random() * 0.45 : 0.25 + random() * 0.5
    const offset = random() * duration
    const drift = -60 + random() * 120
    const rest = along(offset, duration)
    out +=
      `<circle class="p s" cx="${num(random() * 1600)}" r="${num(radius)}" opacity="${num(opacity, 2)}" ` +
      `transform="translate(${num(drift * rest)} ${num(1060 - 1120 * rest)})" ` +
      `style="--d:${num(duration)}s;--o:${num(offset)};--x:${num(drift)}px"/>`
  }

  return out
}

function orbs(count: number): string {
  const random = rng(77)
  let out = ''

  for (let index = 0; index < count; index += 1) {
    // Keep the lanterns to the sides and the corners: the words sit in the middle.
    const side = random() < 0.5 ? random() * 420 : 1180 + random() * 420
    out +=
      `<circle class="orb s" cx="${num(side)}" cy="${num(120 + random() * 780)}" r="${num(14 + random() * 22)}" ` +
      `fill="url(#orb)" style="--d:${num(3.5 + random() * 5)}s;--o:${num(random() * 9)}"/>`
  }

  return out
}

function jelly(x: number, y: number, scale: number, bob: number, beat: number, offset: number): string {
  const tentacles = [-30, -15, 0, 15, 30]
    .map((tx, index) => `<path d="M${tx} 6q7 22 0 44t0 44t0 44${index % 2 === 0 ? 't0 40' : ''}"/>`)
    .join('')

  return (
    `<g transform="translate(${x} ${y}) scale(${scale})"><g class="bob s" style="--d:${bob}s;--o:${offset}">` +
    '<circle cy="-8" r="130" fill="url(#jg)"/>' +
    `<g class="pulse s" style="--d:${beat}s;--o:${offset}">` +
    '<path d="M-46 0C-46-62 46-62 46 0C34 10 22 2 11 9C4 3-4 3-11 9C-22 2-34 10-46 0Z" style="fill:var(--jelly)" opacity=".55"/>' +
    '<ellipse cy="-24" rx="25" ry="15" fill="#fff" opacity=".3"/>' +
    `<g fill="none" stroke-width="3" stroke-linecap="round" style="stroke:var(--jelly)" opacity=".5">${tentacles}</g>` +
    '</g></g></g>'
  )
}

function school(): string {
  const random = rng(19)
  let out = ''

  for (let index = 0; index < 20; index += 1) {
    out +=
      `<path d="M0 0q12-8 26 0q-14 8-26 0zm0 0l-9-6v12z" ` +
      `transform="translate(${num(random() * 380)} ${num(random() * 150)}) scale(${num(0.8 + random() * 0.9, 2)})"/>`
  }

  return `<g class="school s" transform="translate(540 0)" style="fill:var(--sil)" opacity=".5"><g transform="translate(0 230)">${out}</g></g>`
}

function kelp(): string {
  const random = rng(47)
  let out = ''

  for (let index = 0; index < 9; index += 1) {
    const left = index < 5
    const x = num(left ? 24 + random() * 210 : 1366 + random() * 210)
    const tall = num(280 + random() * 280)
    const bend = num(24 + random() * 26)
    out +=
      `<path class="kelp s" d="M${x} 1010C${x - bend} 900 ${x + bend} 800 ${x} 700S${x + bend} ${num(1010 - tall + 120)} ${x - 10} ${num(1010 - tall)}" ` +
      `stroke-width="${num(11 + random() * 15)}" opacity="${num(0.5 + random() * 0.35, 2)}" ` +
      `style="transform-origin:${x}px 1000px;--d:${num(6 + random() * 5)}s;--o:${num(random() * 9)}"/>`
  }

  return `<g fill="none" stroke-linecap="round" style="stroke:var(--sil)">${out}</g>`
}

const RIDGE =
  '<path d="M0 1000V944C110 912 210 958 340 942C480 924 540 966 710 970C900 976 1010 954 1150 946C1300 936 1430 908 1600 928V1000Z" ' +
  'style="fill:var(--sil)" opacity=".85"/>'

function working(): string {
  return (
    '<g class="w">' +
    '<ellipse class="bloom s" cx="800" cy="940" rx="1050" ry="460" fill="url(#glow)"/>' +
    particles(34, 303, true) +
    '</g>'
  )
}

function flourish(): string {
  const random = rng(91)
  let bubbles = ''

  for (let index = 0; index < 16; index += 1) {
    bubbles +=
      `<circle class="f bub" cx="${num(140 + random() * 1320)}" cy="1014" r="${num(5 + random() * 12)}" ` +
      `style="--d:${num(3.4 + random() * 3)}s;--w:${num(random() * 2.2, 2)}s"/>`
  }
  const whale =
    '<g class="f whale" style="fill:var(--whale)"><g transform="translate(0 150) scale(1.35)">' +
    '<path d="M20 62C60 30 150 14 250 16C320 18 390 34 420 58C400 78 340 92 270 94C200 96 120 86 60 70Z"/>' +
    '<path d="M24 62C4 44-22 34-44 30C-30 46-26 58-30 66C-34 78-40 90-52 98C-24 94 4 82 24 66Z"/>' +
    '<path d="M250 86C240 112 210 134 176 142C196 122 210 104 216 88Z"/>' +
    '<path d="M150 22C158 8 172 6 180 16Z"/></g></g>'

  return `${whale}<g fill="none" stroke-width="2" style="stroke:var(--dot)">${bubbles}</g>`
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

/** The whole backdrop as one SVG document. The same view always gives the same string. */
export function drawScene(view: AbyssView, scheme: Scheme): string {
  const zone = Math.min(4, Math.max(0, Math.round(view.zone)))
  const night = NIGHT[zone] ?? NIGHT[0]
  const day = DAY[zone] ?? DAY[0]

  if (night === undefined || day === undefined) {
    return ''
  }
  const shallow = zone <= 1
  const body =
    '<rect width="1600" height="1000" fill="url(#sea)"/>' +
    glows() +
    (zone <= 2 ? rays() : '') +
    (shallow ? school() : '') +
    (zone >= 2 ? orbs(8 + (zone - 2) * 5) : '') +
    particles(64, 11, false) +
    (zone >= 1 ? jelly(196, 560, 1.7, 11, 3.8, 2) + jelly(1436, 300, 1.15, 9, 3.1, 5) : '') +
    (zone >= 3 ? jelly(1310, 760, 0.8, 8, 2.7, 1) : '') +
    (shallow ? kelp() : '') +
    RIDGE +
    (view.mood === 'idle' ? '' : working()) +
    (view.mood === 'done' ? flourish() : '')

  return frame({ at: view.at, mood: view.mood, scheme, dark: night, light: day, css: CSS, defs: DEFS, body })
}
