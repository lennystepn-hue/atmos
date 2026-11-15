// The Horizon scene: a mountain sky, drawn from the local time of day and what Claude is doing.

import { frame, num, rng } from './kit'
import type { HorizonView, Scheme } from '../types'

// ---------------------------------------------------------------------------
// The time of day
// ---------------------------------------------------------------------------

export type Phase = 'Dawn' | 'Day' | 'Dusk' | 'Night'

export function phaseOf(hour: number): Phase {
  if (hour >= 5 && hour < 8) {
    return 'Dawn'
  }

  if (hour >= 8 && hour < 17) {
    return 'Day'
  }

  return hour >= 17 && hour < 21 ? 'Dusk' : 'Night'
}

type Sky = { top: string; mid: string; low: string; glow: string; stars: number; aurora: number; cloud: number }
type Key = Sky & { hour: number }

// The sky at seven moments of the day; every other moment is a blend of its two neighbours.
const NIGHT_SKY: readonly Key[] = [
  { hour: 0, top: '#05071a', mid: '#0a1030', low: '#151d44', glow: '#2b316e', stars: 1, aurora: 0.95, cloud: 0 },
  { hour: 5, top: '#0a0f2c', mid: '#1a1f4d', low: '#4a3a6e', glow: '#b0607a', stars: 0.7, aurora: 0.4, cloud: 0.15 },
  { hour: 7, top: '#1b2a5c', mid: '#4a4f8a', low: '#c9788a', glow: '#ffb38a', stars: 0.15, aurora: 0, cloud: 0.4 },
  { hour: 10, top: '#17305f', mid: '#2c5590', low: '#5b86b8', glow: '#9fc4e6', stars: 0, aurora: 0, cloud: 0.5 },
  { hour: 16, top: '#162c5a', mid: '#2a4f88', low: '#5a7fb0', glow: '#a8c4e0', stars: 0, aurora: 0, cloud: 0.5 },
  { hour: 19, top: '#1a1f52', mid: '#56356e', low: '#d06a5a', glow: '#ffb070', stars: 0.2, aurora: 0, cloud: 0.4 },
  { hour: 21, top: '#0a0d2a', mid: '#1c1b4a', low: '#4a3068', glow: '#8a4a7a', stars: 0.8, aurora: 0.5, cloud: 0.1 },
  { hour: 24, top: '#05071a', mid: '#0a1030', low: '#151d44', glow: '#2b316e', stars: 1, aurora: 0.95, cloud: 0 },
]

const DAY_SKY: readonly Key[] = [
  { hour: 0, top: '#c6cce8', mid: '#d8dbf0', low: '#ebe6f2', glow: '#f6eef6', stars: 0.4, aurora: 0.4, cloud: 0.25 },
  { hour: 5, top: '#cdd1ee', mid: '#e6d9ee', low: '#f8dcd6', glow: '#ffd9c4', stars: 0.2, aurora: 0.15, cloud: 0.5 },
  { hour: 7, top: '#bcd6f2', mid: '#dfe3f4', low: '#fde3cf', glow: '#ffe2b8', stars: 0, aurora: 0, cloud: 0.75 },
  { hour: 10, top: '#a9d2f5', mid: '#c8e3f8', low: '#e9f4fb', glow: '#ffffff', stars: 0, aurora: 0, cloud: 0.9 },
  { hour: 16, top: '#a6cdf2', mid: '#cfe2f5', low: '#f1f1ec', glow: '#fff6dc', stars: 0, aurora: 0, cloud: 0.9 },
  { hour: 19, top: '#b9c1ea', mid: '#ecc9d6', low: '#ffd2a8', glow: '#ffb98a', stars: 0, aurora: 0, cloud: 0.7 },
  { hour: 21, top: '#c0c5e6', mid: '#d9d2ea', low: '#f0dfe6', glow: '#f6e3e6', stars: 0.3, aurora: 0.25, cloud: 0.35 },
  { hour: 24, top: '#c6cce8', mid: '#d8dbf0', low: '#ebe6f2', glow: '#f6eef6', stars: 0.4, aurora: 0.4, cloud: 0.25 },
]

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** A color `amount` of the way from `from` to `to`. */
function mix(from: string, to: string, amount: number): string {
  const a = channels(from)
  const b = channels(to)
  const blend = (index: 0 | 1 | 2) => Math.round(a[index] + (b[index] - a[index]) * amount)

  return `#${((1 << 24) | (blend(0) << 16) | (blend(1) << 8) | blend(2)).toString(16).slice(1)}`
}

function skyAt(keys: readonly Key[], hour: number): Sky {
  const time = ((hour % 24) + 24) % 24
  let before = keys[0]
  let after = keys[keys.length - 1]

  for (let index = 0; index < keys.length - 1; index += 1) {
    const here = keys[index]
    const there = keys[index + 1]

    if (here !== undefined && there !== undefined && time >= here.hour && time <= there.hour) {
      before = here
      after = there
    }
  }

  if (before === undefined || after === undefined) {
    throw new Error('the sky has no keys')
  }
  const span = after.hour - before.hour
  const amount = span === 0 ? 0 : (time - before.hour) / span
  const lerp = (a: number, b: number) => num(a + (b - a) * amount, 2)

  return {
    top: mix(before.top, after.top, amount),
    mid: mix(before.mid, after.mid, amount),
    low: mix(before.low, after.low, amount),
    glow: mix(before.glow, after.glow, amount),
    stars: lerp(before.stars, after.stars),
    aurora: lerp(before.aurora, after.aurora),
    cloud: lerp(before.cloud, after.cloud),
  }
}

/** Where the sun or the moon stands: each crosses the sky on one arc, left to right. */
function orbAt(hour: number): { x: number; y: number; isSun: boolean } {
  const time = ((hour % 24) + 24) % 24
  const isSun = time >= 6 && time < 20
  const along = isSun ? (time - 6) / 14 : ((time - 20 + 24) % 24) / 10

  return { x: num(170 + along * 1260), y: num(680 - Math.sin(Math.PI * along) * 520), isSun }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CSS = [
  '.st{animation:st var(--d) ease-in-out infinite alternate}',
  '@keyframes st{from{opacity:.25}to{opacity:1}}',
  '.au{animation:au var(--d) ease-in-out infinite alternate}',
  '@keyframes au{from{transform:translateX(-70px) skewX(-5deg);opacity:.72}to{transform:translateX(70px) skewX(5deg);opacity:1}}',
  '.cu{animation:cu var(--d) ease-in-out infinite alternate}',
  '@keyframes cu{from{transform:translateX(-26px);opacity:.15}to{transform:translateX(26px);opacity:.7}}',
  '.cl{animation:cl var(--d) linear infinite}',
  '@keyframes cl{from{transform:translateX(-520px)}to{transform:translateX(2060px)}}',
  '.mi{animation:mi var(--d) ease-in-out infinite alternate}',
  '@keyframes mi{from{transform:translateX(-90px)}to{transform:translateX(90px)}}',
  '.fan{animation:fan 140s linear infinite}',
  '@keyframes fan{to{transform:rotate(360deg)}}',
  '.m-done .shoot{animation:shoot 1.5s ease-in var(--w) 1 both}',
  '@keyframes shoot{0%{transform:translate(0,0);opacity:0}12%{opacity:1}80%{opacity:1}100%{transform:translate(-640px,230px);opacity:0}}',
  '.m-done .flock{animation:flock 13s linear .4s 1 both}',
  '@keyframes flock{0%{transform:translate(-240px,60px);opacity:0}6%{opacity:.75}92%{opacity:.75}100%{transform:translate(1840px,-90px);opacity:0}}',
  '.wing{transform-box:fill-box;transform-origin:center;animation:wing .9s ease-in-out infinite alternate}',
  '@keyframes wing{from{transform:scaleY(1)}to{transform:scaleY(.35)}}',
].join('')

const ribbon = (id: string, color: string, peak: number) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--${color});stop-opacity:0"/>` +
  `<stop offset=".36" style="stop-color:var(--${color});stop-opacity:${peak}"/>` +
  `<stop offset="1" style="stop-color:var(--${color});stop-opacity:0"/></linearGradient>`

const DEFS =
  '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" style="stop-color:var(--top)"/><stop offset=".45" style="stop-color:var(--mid)"/>' +
  '<stop offset=".78" style="stop-color:var(--low)"/><stop offset="1" style="stop-color:var(--low)"/></linearGradient>' +
  '<radialGradient id="halo"><stop offset="0" style="stop-color:var(--orb);stop-opacity:.75"/>' +
  '<stop offset=".3" style="stop-color:var(--glow);stop-opacity:.4"/>' +
  '<stop offset="1" style="stop-color:var(--glow);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="band" cx=".5" cy="1" r=".9"><stop offset="0" style="stop-color:var(--glow);stop-opacity:.85"/>' +
  '<stop offset="1" style="stop-color:var(--glow);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="haze"><stop offset="0" style="stop-color:var(--low);stop-opacity:.7"/>' +
  '<stop offset="1" style="stop-color:var(--low);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="beam" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="560">' +
  '<stop offset=".14" style="stop-color:var(--orb);stop-opacity:.5"/>' +
  '<stop offset="1" style="stop-color:var(--orb);stop-opacity:0"/></radialGradient>' +
  ribbon('au1', 'aur1', 0.44) +
  ribbon('au2', 'aur2', 0.34) +
  '<linearGradient id="tail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--star);stop-opacity:0"/>' +
  '<stop offset="1" style="stop-color:var(--star)"/></linearGradient>'

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

function stars(): string {
  const random = rng(3)
  let out = ''

  for (let index = 0; index < 110; index += 1) {
    out +=
      `<circle class="st s" cx="${num(random() * 1600)}" cy="${num(random() * 620)}" r="${num(0.8 + random() * 1.6)}" ` +
      `style="--d:${num(2 + random() * 4.5)}s;--o:${num(random() * 9)}"/>`
  }

  return `<g style="fill:var(--star);opacity:var(--starsA)">${out}</g>`
}

const RIBBONS = [
  ['au1', 'M-200 300C150 180 420 380 760 250S1300 150 1800 280V440C1350 340 1050 480 760 410S150 310-200 460Z', 21, 0],
  ['au2', 'M-200 150C250 80 600 230 950 130S1500 80 1800 150V280C1500 230 1200 330 950 260S250 220-200 290Z', 27, 9],
  ['au1', 'M-200 230C200 300 500 140 850 210S1400 300 1800 190V340C1400 440 1100 310 850 350S200 430-200 360Z', 24, 4],
] as const

function aurora(seed: number, count: number, withRibbons: boolean): string {
  const random = rng(seed)
  let out = ''

  for (const [fill, path, duration, offset] of withRibbons ? RIBBONS : []) {
    out += `<path class="au s" d="${path}" fill="url(#${fill})" style="--d:${duration}s;--o:${offset}"/>`
  }

  // The curtain: thin upright rays that drift within the ribbons.
  for (let index = 0; index < count; index += 1) {
    const x = num(random() * 1600)
    const top = num(90 + random() * 150)
    out +=
      `<rect class="cu s" x="${x}" y="${top}" width="${num(10 + random() * 24)}" height="${num(150 + random() * 170)}" ` +
      `fill="url(#${random() < 0.7 ? 'au1' : 'au2'})" style="--d:${num(7 + random() * 9)}s;--o:${num(random() * 16)}"/>`
  }

  return out
}

function clouds(): string {
  const random = rng(41)
  let out = ''

  for (let index = 0; index < 6; index += 1) {
    const y = num(110 + random() * 330)
    const size = 0.7 + random() * 0.9
    const duration = num(190 + random() * 120)
    out +=
      `<g class="cl s" style="--d:${duration}s;--o:${num(random() * duration)}" opacity="${num(0.55 + random() * 0.4, 2)}">` +
      `<g transform="translate(0 ${y}) scale(${num(size, 2)})">` +
      '<ellipse cx="0" cy="0" rx="150" ry="34"/><ellipse cx="-60" cy="-22" rx="74" ry="34"/>' +
      '<ellipse cx="28" cy="-36" rx="92" ry="46"/><ellipse cx="104" cy="-14" rx="66" ry="28"/></g></g>'
  }

  return `<g style="fill:var(--cloud);opacity:var(--cloudA)">${out}</g>`
}

/** The height of a ridge at `x`: sharp peaks, a few big and many small. */
function crest(x: number, seed: number, random: () => number): number {
  const peak = (wave: number) => 1 - Math.abs(Math.sin(wave))

  return 0.56 * peak(x / 330 + seed) + 0.3 * peak(x / 131 + seed * 2.3) + 0.14 * random()
}

function ridge(seed: number, base: number, height: number, color: string, withPines: boolean): string {
  const random = rng(seed)
  let path = `M0 1000V${base}`
  let pines = ''

  for (let x = 0; x <= 1600; x += 32) {
    const y = num(base - height * crest(x, seed, random))
    path += `L${x} ${y}`

    if (withPines && random() < 0.72) {
      const tall = num(26 + random() * 44)
      const wide = num(8 + random() * 8)
      const px = num(x + random() * 28)
      pines += `M${px} ${num(y - tall)}L${num(px + wide)} ${num(y + 14)}H${num(px - wide)}Z`
    }
  }

  return `<path d="${path}L1600 1000Z${pines}" style="fill:var(--${color})"/>`
}

function mist(y: number, seed: number): string {
  const random = rng(seed)
  let out = ''

  for (let index = 0; index < 3; index += 1) {
    out +=
      `<ellipse class="mi s" cx="${num(200 + random() * 1200)}" cy="${num(y + random() * 40)}" rx="${num(420 + random() * 300)}" ` +
      `ry="${num(46 + random() * 30)}" fill="url(#haze)" style="--d:${num(34 + random() * 30)}s;--o:${num(random() * 50)}"/>`
  }

  return `<g>${out}</g>`
}

function orb(x: number, y: number, isSun: boolean): string {
  return (
    `<circle cx="${x}" cy="${y}" r="${isSun ? 300 : 230}" fill="url(#halo)"/>` +
    `<circle cx="${x}" cy="${y}" r="${isSun ? 56 : 44}" style="fill:var(--orb)"/>`
  )
}

function working(x: number, y: number, hasAurora: boolean): string {
  if (hasAurora) {
    // The northern lights gather: more rays in the curtain, nothing louder.
    return `<g class="w">${aurora(59, 24, false)}</g>`
  }
  let rays = ''

  for (let index = 0; index < 14; index += 1) {
    rays += `<path d="M0 -90L${index % 2 === 0 ? 16 : 9} -${index % 2 === 0 ? 560 : 380}H-${index % 2 === 0 ? 16 : 9}Z" transform="rotate(${num(index * (360 / 14))})"/>`
  }

  // Daylight at work: a slow wheel of rays around the sun.
  return (
    `<g class="w"><g transform="translate(${x} ${y})"><g class="fan s" fill="url(#beam)">${rays}</g></g></g>`
  )
}

function flourish(isNight: boolean): string {
  if (isNight) {
    const star = (x: number, y: number, wait: number, size: number) =>
      `<g transform="translate(${x} ${y}) scale(${size})"><g class="f shoot" style="--w:${wait}s">` +
      '<path d="M0 0L230 -82L232 -76Z" fill="url(#tail)" transform="rotate(180) translate(-232 79)"/>' +
      '<circle r="4.5" style="fill:var(--star)"/></g></g>'

    return star(1260, 110, 0.5, 1) + star(760, 70, 2.1, 0.7)
  }
  let birds = ''

  for (let index = 0; index < 9; index += 1) {
    const row = Math.ceil(index / 2)
    const side = index % 2 === 0 ? 1 : -1
    birds += `<path class="wing" d="M-13-7L0 0L13-7" transform="translate(${-row * 34} ${side * row * 20})"/>`
  }

  return (
    '<g class="f flock" fill="none" stroke-width="3" stroke-linecap="round" style="stroke:var(--m3)">' +
    `<g transform="translate(0 250)">${birds}</g></g>`
  )
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

function colorsOf(sky: Sky, isSun: boolean, isDark: boolean): Record<string, string | number> {
  return {
    top: sky.top,
    mid: sky.mid,
    low: sky.low,
    glow: sky.glow,
    starsA: sky.stars,
    auroraA: sky.aurora,
    cloudA: sky.cloud,
    m1: mix(sky.low, isDark ? '#0b0f26' : '#8ea3c8', isDark ? 0.55 : 0.5),
    m2: mix(sky.low, isDark ? '#070a1b' : '#5f76a0', isDark ? 0.76 : 0.66),
    m3: mix(sky.low, isDark ? '#03040c' : '#394d77', isDark ? 0.9 : 0.82),
    orb: isSun ? (isDark ? '#ffd9a0' : '#fff6cf') : isDark ? '#eef1ff' : '#ffffff',
    star: '#ffffff',
    aur1: isDark ? '#4dffb0' : '#74ecc3',
    aur2: isDark ? '#a56bff' : '#bda0ff',
    cloud: isDark ? '#c9d6f2' : '#ffffff',
  }
}

/** The whole backdrop as one SVG document. The same view always gives the same string. */
export function drawScene(view: HorizonView, scheme: Scheme): string {
  const night = skyAt(NIGHT_SKY, view.hour)
  const day = skyAt(DAY_SKY, view.hour)
  const { x, y, isSun } = orbAt(view.hour)
  // What is in the sky is decided by the darker half, so both halves hold the same things.
  const hasStars = night.stars > 0.02 || day.stars > 0.02
  const hasAurora = night.aurora > 0.02 || day.aurora > 0.02
  const hasClouds = night.cloud > 0.02 || day.cloud > 0.02
  const body =
    '<rect width="1600" height="1000" fill="url(#sky)"/>' +
    (hasStars ? stars() : '') +
    (hasAurora ? `<g style="opacity:var(--auroraA)">${aurora(23, 16, true)}</g>` : '') +
    orb(x, y, isSun) +
    '<ellipse cx="800" cy="760" rx="1100" ry="330" fill="url(#band)"/>' +
    (hasClouds ? clouds() : '') +
    ridge(2, 700, 270, 'm1', false) +
    mist(690, 71) +
    ridge(7, 800, 210, 'm2', false) +
    mist(800, 83) +
    ridge(13, 930, 170, 'm3', true) +
    (view.mood === 'idle' ? '' : working(x, y, night.aurora >= 0.3)) +
    (view.mood === 'done' ? flourish(!isSun) : '')

  return frame({
    at: view.at,
    mood: view.mood,
    scheme,
    dark: colorsOf(night, isSun, true),
    light: colorsOf(day, isSun, false),
    css: CSS,
    defs: DEFS,
    body,
  })
}
