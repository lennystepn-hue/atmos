// The Arcade scene: a neon grid running to a striped sun, drawn from what Claude is doing.

import { along, frame, num, rng, track } from './kit'
import type { ArcadeView, Scheme } from '../types'

const NIGHT = {
  sky0: '#0b0221',
  sky1: '#2a0845',
  sky2: '#ff2e88',
  sun0: '#ffe14d',
  sun1: '#ff3f8e',
  glow: '#ff4fa0',
  grid: '#ff4fd8',
  floor0: '#1c0740',
  floor1: '#05010f',
  mtn: '#12052b',
  line: '#29f0ff',
  star: '#ffffff',
  starA: 1,
  ink: '#ffffff',
  neon: '#29f0ff',
  scan: 0.2,
}

const DAY = {
  sky0: '#ffd3ea',
  sky1: '#d6ecff',
  sky2: '#fff1b5',
  sun0: '#fff3a6',
  sun1: '#ff9ec6',
  glow: '#ffffff',
  grid: '#ff7fc0',
  floor0: '#f6e6ff',
  floor1: '#d8c6ff',
  mtn: '#eadcff',
  line: '#8a6cff',
  star: '#ffffff',
  starA: 0.7,
  ink: '#7c5cff',
  neon: '#ff5fb0',
  scan: 0.06,
}

/** Where the floor meets the sky, and the point every line runs to. */
const HORIZON = 600
const SUN = { x: 800, y: 452, r: 214 }

const CSS = [
  '.st{animation:st var(--d) ease-in-out infinite alternate}',
  '@keyframes st{from{opacity:.2}to{opacity:1}}',
  // One line of the floor, running from the horizon toward you, faster as it nears.
  '.row{animation:row 5.6s cubic-bezier(.55,0,1,.6) infinite}',
  `@keyframes row{0%{transform:translateY(${HORIZON}px) scaleY(.4);opacity:0}14%{opacity:.85}100%{transform:translateY(1010px) scaleY(3.2);opacity:1}}`,
  '.wp{transform-box:fill-box;transform-origin:0 50%;animation:wp var(--d) linear infinite}',
  '@keyframes wp{0%{transform:translateX(0) scaleX(.2);opacity:0}22%{opacity:.75}100%{transform:translateX(640px) scaleX(2.4);opacity:0}}',
  '.m-done .clear{opacity:1;animation:clear 4.4s ease-out .2s 1 both}',
  '@keyframes clear{0%{opacity:0;transform:scale(.84)}11%{opacity:1;transform:scale(1)}78%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04)}}',
  '.m-done .bit{animation:bit var(--d) ease-in var(--w) 1 both}',
  '@keyframes bit{0%{transform:translateY(0) rotate(0);opacity:0}10%{opacity:1}100%{transform:translateY(560px) rotate(300deg);opacity:0}}',
  'text{font-family:ui-monospace,"Cascadia Mono","SF Mono",Consolas,monospace;font-weight:800;letter-spacing:12px;text-anchor:middle}',
].join('')

const DEFS =
  `<linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${HORIZON}">` +
  '<stop offset="0" style="stop-color:var(--sky0)"/><stop offset=".62" style="stop-color:var(--sky1)"/>' +
  '<stop offset="1" style="stop-color:var(--sky2)"/></linearGradient>' +
  `<linearGradient id="sun" gradientUnits="userSpaceOnUse" x1="0" y1="${SUN.y - SUN.r}" x2="0" y2="${HORIZON}">` +
  '<stop offset="0" style="stop-color:var(--sun0)"/><stop offset="1" style="stop-color:var(--sun1)"/></linearGradient>' +
  '<radialGradient id="halo"><stop offset="0" style="stop-color:var(--glow);stop-opacity:.7"/>' +
  '<stop offset="1" style="stop-color:var(--glow);stop-opacity:0"/></radialGradient>' +
  `<linearGradient id="floor" gradientUnits="userSpaceOnUse" x1="0" y1="${HORIZON}" x2="0" y2="1000">` +
  '<stop offset="0" style="stop-color:var(--floor0)"/><stop offset="1" style="stop-color:var(--floor1)"/></linearGradient>' +
  `<linearGradient id="far" gradientUnits="userSpaceOnUse" x1="0" y1="${HORIZON}" x2="0" y2="${HORIZON + 130}">` +
  '<stop offset="0" style="stop-color:var(--floor0)"/><stop offset="1" style="stop-color:var(--floor0);stop-opacity:0"/></linearGradient>' +
  `<clipPath id="disc"><circle cx="${SUN.x}" cy="${SUN.y}" r="${SUN.r}"/></clipPath>` +
  '<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.4"/></pattern>'

function stars(): string {
  const random = rng(17)
  let out = ''

  for (let index = 0; index < 70; index += 1) {
    out +=
      `<circle class="st s" cx="${num(random() * 1600)}" cy="${num(random() * 430)}" r="${num(0.9 + random() * 1.7)}" ` +
      `style="--d:${num(1.6 + random() * 4)}s;--o:${num(random() * 8)}"/>`
  }

  return `<g style="fill:var(--star);opacity:var(--starA)">${out}</g>`
}

/** The sun: whole above, cut into thinning bars as it sinks toward the horizon. */
function sun(): string {
  let bars = `<rect x="560" y="${SUN.y - SUN.r}" width="480" height="${SUN.r - 6}"/>`
  let y = SUN.y - 6
  let tall = 30
  let gap = 5

  while (y < HORIZON) {
    bars += `<rect x="560" y="${num(y)}" width="480" height="${num(tall)}"/>`
    y += tall + gap
    tall = Math.max(7, tall - 4.5)
    gap += 3.2
  }

  return (
    `<circle cx="${SUN.x}" cy="${SUN.y}" r="430" fill="url(#halo)"/>` +
    `<g clip-path="url(#disc)" fill="url(#sun)">${bars}</g>`
  )
}

const MOUNTAINS =
  '<g style="fill:var(--mtn);stroke:var(--line)" stroke-width="2.5" stroke-linejoin="round">' +
  `<path d="M-20 ${HORIZON}L120 470L210 540L330 400L450 520L540 470L640 ${HORIZON}Z"/>` +
  `<path d="M960 ${HORIZON}L1060 480L1150 530L1270 390L1390 510L1480 450L1620 ${HORIZON}Z"/>` +
  '<path fill="none" opacity=".42" d="M330 400L296 600M330 400L384 600M120 470L150 600M540 470L520 600M210 540L236 600' +
  'M1270 390L1236 600M1270 390L1326 600M1060 480L1086 600M1480 450L1456 600M1390 510L1412 600"/></g>'

function floor(): string {
  let lines = ''

  for (let x = -2600; x <= 4200; x += 200) {
    lines += `M800 ${HORIZON}L${x} 1000`
  }
  let rows = ''

  for (let index = 0; index < 14; index += 1) {
    const rest = index / 14
    // At rest the lines stand where running ones would be: bunched at the horizon, wide apart up close.
    const near = rest ** 2.2
    rows +=
      `<rect class="row s" x="0" y="-1" width="1600" height="2" opacity="${num(Math.min(1, 0.25 + rest * 2), 2)}" ` +
      `transform="translate(0 ${num(HORIZON + 410 * near)}) scale(1 ${num(0.4 + 2.8 * near, 2)})" ` +
      `style="--o:${num(rest * 5.6, 2)}"/>`
  }

  return (
    `<rect y="${HORIZON}" width="1600" height="400" fill="url(#floor)"/>` +
    `<path d="${lines}" fill="none" stroke-width="2" style="stroke:var(--grid)" opacity=".75"/>` +
    `<g style="fill:var(--grid)">${rows}</g>` +
    `<rect y="${HORIZON}" width="1600" height="130" fill="url(#far)"/>` +
    `<ellipse cx="800" cy="${HORIZON}" rx="900" ry="46" fill="url(#halo)"/>` +
    `<rect y="${HORIZON - 2}" width="1600" height="4" style="fill:var(--grid)"/>`
  )
}

const STREAK_FADE = [[0, 0], [0.22, 0.75], [1, 0]] as const

function working(): string {
  const random = rng(211)
  let out = ''

  // Warp: streaks of light leaving the sun, a steady stream of them.
  for (let index = 0; index < 34; index += 1) {
    const angle = num(-172 + random() * 164)
    const duration = num(1.4 + random() * 1.6, 2)
    const offset = num(random() * duration, 2)
    const rest = along(offset, duration)
    out +=
      `<g transform="rotate(${angle} ${SUN.x} ${SUN.y})"><rect class="wp s" x="${num(SUN.x + 250 + random() * 60)}" y="${SUN.y - 1.5}" ` +
      `width="${num(60 + random() * 80)}" height="3" opacity="${num(track(rest, STREAK_FADE), 2)}" ` +
      `transform="translate(${num(640 * rest)} 0) scale(${num(0.2 + 2.2 * rest, 2)} 1)" ` +
      `style="--d:${duration}s;--o:${offset}"/></g>`
  }

  return `<g class="w" style="fill:var(--neon)">${out}</g>`
}

function flourish(stage: number): string {
  const random = rng(307)
  const label = `STAGE ${String(Math.max(1, Math.round(stage))).padStart(2, '0')} CLEAR`
  let bits = ''

  for (let index = 0; index < 26; index += 1) {
    const size = num(8 + random() * 10)
    bits +=
      `<rect class="f bit" x="${num(120 + random() * 1360)}" y="${num(-20 + random() * 120)}" width="${size}" height="${size}" ` +
      `style="fill:var(--${random() < 0.5 ? 'neon' : 'grid'});--d:${num(1.8 + random() * 1.6, 2)}s;--w:${num(random() * 1.2, 2)}s"/>`
  }

  return (
    '<g class="f clear" style="transform-origin:800px 170px">' +
    `<text x="800" y="196" font-size="88" fill="none" stroke-width="16" stroke-linejoin="round" style="stroke:var(--neon)" opacity=".28">${label}</text>` +
    `<text x="800" y="196" font-size="88" stroke-width="2.5" style="fill:var(--ink);stroke:var(--neon)">${label}</text></g>` +
    bits
  )
}

/** The whole backdrop as one SVG document. The same view always gives the same string. */
export function drawScene(view: ArcadeView, scheme: Scheme): string {
  const body =
    `<rect width="1600" height="${HORIZON}" fill="url(#sky)"/>` +
    stars() +
    sun() +
    MOUNTAINS +
    floor() +
    (view.mood === 'idle' ? '' : working()) +
    (view.mood === 'done' ? flourish(view.stage) : '') +
    '<rect width="1600" height="1000" fill="url(#scan)" style="opacity:var(--scan)"/>'

  return frame({ at: view.at, mood: view.mood, scheme, dark: NIGHT, light: DAY, css: CSS, defs: DEFS, body })
}
