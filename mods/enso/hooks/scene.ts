// The Ensō scene: an ink-wash garden, drawn from a focus sitting and what Claude is doing.

import { along, frame, num, rng } from './kit'
import type { EnsoView, Scheme } from '../types'

const DAY = {
  paper0: '#f4eddd',
  paper1: '#e5dac3',
  ink: '#23201c',
  wash: '#5c574e',
  far: '#8f8b82',
  mid: '#5d5a53',
  near: '#2c2925',
  sun: '#c8402c',
  seal: '#c8402c',
  petal: '#c4503c',
  mist: '#f4eddd',
}

const NIGHT = {
  paper0: '#1d1d20',
  paper1: '#0f0f10',
  ink: '#e6e1d4',
  wash: '#9a968b',
  far: '#3a3a40',
  mid: '#515157',
  near: '#77756f',
  sun: '#ece7d9',
  seal: '#c8402c',
  petal: '#e0b6ac',
  mist: '#1d1d20',
}

const CSS = [
  '.bl{animation:bl var(--d) ease-in-out infinite alternate}',
  '@keyframes bl{from{transform:translate(-50px,-20px)}to{transform:translate(60px,30px)}}',
  '.mi{animation:mi var(--d) ease-in-out infinite alternate}',
  '@keyframes mi{from{transform:translateX(-110px)}to{transform:translateX(110px)}}',
  '.sway{animation:sway var(--d) ease-in-out infinite alternate}',
  '@keyframes sway{from{transform:rotate(-1.1deg)}to{transform:rotate(1.1deg)}}',
  '.leaf{transform-box:fill-box;transform-origin:0 50%;animation:leaf var(--d) ease-in-out infinite alternate}',
  '@keyframes leaf{from{transform:rotate(-5deg)}to{transform:rotate(6deg)}}',
  '.pt{animation:fall var(--d) linear infinite}',
  '@keyframes fall{from{transform:translate(0,-70px) rotate(0)}to{transform:translate(var(--x),1090px) rotate(var(--r))}}',
  // The circle: whole when nothing is being timed, painted stroke by stroke during a sitting.
  '.enso{stroke-dasharray:100;stroke-dashoffset:5}',
  '.painting .enso{stroke-dashoffset:var(--now);animation:paint var(--n) linear var(--e) 1 both}',
  '@keyframes paint{from{stroke-dashoffset:100}to{stroke-dashoffset:5}}',
  '.glide{animation:glide 52s linear infinite}',
  '@keyframes glide{from{transform:translate(-320px,40px)}to{transform:translate(1900px,-70px)}}',
  '.wing{transform-box:fill-box;transform-origin:50% 100%;animation:wing 2.4s ease-in-out infinite alternate}',
  '@keyframes wing{from{transform:scaleY(1)}to{transform:scaleY(.55)}}',
  '.m-done .seal{animation:stamp .55s cubic-bezier(.2,1.5,.4,1) .25s 1 both}',
  '@keyframes stamp{from{transform:scale(2);opacity:0}to{transform:scale(1);opacity:1}}',
  '.m-done .gust{animation:gust var(--d) ease-in var(--w) 1 both}',
  '@keyframes gust{0%{transform:translate(0,0) rotate(0);opacity:0}10%{opacity:.85}100%{transform:translate(1500px,var(--y)) rotate(var(--r));opacity:0}}',
].join('')

const fade = (id: string, color: string, top: number, foot: number) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--${color});stop-opacity:${top}"/>` +
  `<stop offset="1" style="stop-color:var(--${color});stop-opacity:${foot}"/></linearGradient>`

const DEFS =
  '<linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" style="stop-color:var(--paper0)"/><stop offset="1" style="stop-color:var(--paper1)"/></linearGradient>' +
  '<radialGradient id="blot"><stop offset="0" style="stop-color:var(--wash);stop-opacity:.16"/>' +
  '<stop offset="1" style="stop-color:var(--wash);stop-opacity:0"/></radialGradient>' +
  '<radialGradient id="haze"><stop offset="0" style="stop-color:var(--mist);stop-opacity:.9"/>' +
  '<stop offset="1" style="stop-color:var(--mist);stop-opacity:0"/></radialGradient>' +
  fade('far', 'far', 0.55, 0) +
  fade('mid', 'mid', 0.72, 0.04) +
  fade('near', 'near', 0.94, 0.55)

const PETAL = 'M0 0C6-10 18-10 22 0C18 8 6 8 0 0Z'

// The circle starts low on the left and is drawn clockwise, as a brush would.
const RING = 'M1092.1 415.7A180 180 0 0 1 1367.9 184.3A180 180 0 0 1 1092.1 415.7'

function blots(): string {
  const random = rng(9)
  let out = ''

  for (let index = 0; index < 5; index += 1) {
    out +=
      `<circle class="bl s" cx="${num(random() * 1600)}" cy="${num(120 + random() * 560)}" r="${num(260 + random() * 240)}" ` +
      `fill="url(#blot)" style="--d:${num(44 + random() * 30)}s;--o:${num(random() * 60)}"/>`
  }

  return out
}

function mist(y: number, seed: number): string {
  const random = rng(seed)
  let out = ''

  for (let index = 0; index < 3; index += 1) {
    out +=
      `<ellipse class="mi s" cx="${num(150 + random() * 1300)}" cy="${num(y + random() * 30)}" rx="${num(460 + random() * 280)}" ` +
      `ry="${num(50 + random() * 30)}" fill="url(#haze)" style="--d:${num(40 + random() * 30)}s;--o:${num(random() * 60)}"/>`
  }

  return out
}

/** One bamboo cane: jointed, a little tilted, with leaves at some of its joints. */
function cane(x: number, wide: number, tilt: number, seed: number): string {
  const random = rng(seed)
  let out = ''

  for (let joint = 0; joint < 9; joint += 1) {
    const top = 1010 - (joint + 1) * 124
    out += `<rect x="${num(x - wide / 2)}" y="${top + 7}" width="${wide}" height="117" rx="${num(wide / 3)}"/>`

    if (joint >= 2 && random() < 0.7) {
      const side = random() < 0.5 ? -1 : 1

      for (let leaf = 0; leaf < 3; leaf += 1) {
        const turn = num(side === 1 ? -58 + leaf * 26 + random() * 10 : 238 - leaf * 26 - random() * 10)
        out +=
          `<g transform="translate(${num(x + side * (wide / 2))} ${top + 6}) rotate(${turn}) scale(${num(0.8 + random() * 0.7, 2)})">` +
          `<path class="leaf s" d="M0 0Q46-17 124-4Q52 11 0 0Z" style="--d:${num(3 + random() * 3)}s;--o:${num(random() * 6)}"/></g>`
      }
    }
  }

  return (
    `<g class="sway s" style="transform-origin:${x}px 1000px;--d:${num(6 + random() * 4)}s;--o:${num(random() * 8)}">` +
    `<g transform="rotate(${tilt} ${x} 1000)">${out}</g></g>`
  )
}

function petals(count: number, seed: number, fast: boolean): string {
  const random = rng(seed)
  let out = ''

  for (let index = 0; index < count; index += 1) {
    const duration = fast ? 9 + random() * 7 : 18 + random() * 16
    const offset = random() * duration
    const dx = -420 + random() * 180
    const spin = 200 + random() * 500
    const rest = along(offset, duration)
    // The petal's place is on the group around it: its own transform is the fall, which the animation takes over.
    out +=
      `<g transform="translate(${num(200 + random() * 1500)} 0) scale(${num(0.8 + random() * 0.9, 2)})">` +
      `<path class="pt s" d="${PETAL}" opacity="${num(0.45 + random() * 0.4, 2)}" ` +
      `transform="translate(${num(dx * rest)} ${num(-70 + 1160 * rest)}) rotate(${num(spin * rest)})" ` +
      `style="--d:${num(duration)}s;--o:${num(offset)};--x:${num(dx)}px;--r:${num(spin)}deg"/></g>`
  }

  return `<g style="fill:var(--petal)">${out}</g>`
}

function ring(view: EnsoView): string {
  const stroke = (scale: number, wide: number, opacity: number) =>
    `<path class="enso" d="${RING}" pathLength="100" stroke-width="${wide}" opacity="${opacity}" ` +
    `transform="translate(1230 300) scale(${scale}) translate(-1230 -300)"/>`
  const strokes = stroke(1, 36, 0.88) + stroke(1.085, 8, 0.3) + stroke(0.915, 6, 0.26)
  const base = '<g fill="none" stroke-linecap="round"'

  if (view.focus === null) {
    return `${base} style="stroke:var(--ink)">${strokes}</g>`
  }
  // How far into the sitting the scene was drawn: the brush carries on from there by itself.
  const elapsed = Math.min(view.focus.seconds, (((view.at - view.focus.startedAt) % 86_400) + 86_400) % 86_400)

  const unpainted = num(100 - 95 * (view.focus.seconds > 0 ? elapsed / view.focus.seconds : 1), 2)

  return (
    `${base} class="painting" style="stroke:var(--ink);--n:${num(view.focus.seconds)}s;--e:-${num(elapsed, 2)}s;--now:${unpainted}">` +
    `${strokes}</g>`
  )
}

const SEAL =
  '<g class="seal" style="transform-origin:1414px 492px"><rect x="1392" y="470" width="44" height="44" rx="6" style="fill:var(--seal)"/>' +
  '<path d="M1402 481H1426M1402 492H1418M1402 503H1426M1426 487V498" fill="none" stroke-width="3.5" stroke-linecap="round" style="stroke:var(--paper0)"/></g>'

function working(): string {
  const bird = (x: number, y: number, size: number) =>
    `<g transform="translate(${x} ${y}) scale(${size})"><path class="wing" d="M0 0C14-15 30-17 44-6C56-18 74-17 88-3"/></g>`

  // Something passes through the garden while the work goes on: a breeze, three cranes.
  return (
    '<g class="w">' +
    petals(18, 301, true) +
    '<g class="glide s" fill="none" stroke-width="4.5" stroke-linecap="round" style="stroke:var(--ink)" opacity=".75">' +
    bird(0, 190, 1) +
    bird(-110, 236, 0.8) +
    bird(-196, 170, 0.7) +
    '</g></g>'
  )
}

function flourish(): string {
  const random = rng(409)
  let out = ''

  for (let index = 0; index < 26; index += 1) {
    out +=
      `<g transform="translate(${num(-80 + random() * 500)} ${num(120 + random() * 620)}) scale(${num(0.9 + random(), 2)})">` +
      `<path class="f gust" d="${PETAL}" style="--d:${num(2.6 + random() * 2.4, 2)}s;--w:${num(random() * 1.3, 2)}s;` +
      `--y:${num(-160 + random() * 420)}px;--r:${num(300 + random() * 600)}deg"/></g>`
  }

  return `<g style="fill:var(--petal)">${out}</g>`
}

/** The whole backdrop as one SVG document. The same view always gives the same string. */
export function drawScene(view: EnsoView, scheme: Scheme): string {
  const body =
    '<rect width="1600" height="1000" fill="url(#paper)"/>' +
    blots() +
    '<circle cx="330" cy="250" r="78" style="fill:var(--sun)" opacity=".86"/>' +
    '<path d="M-50 760C80 700 150 560 260 540C340 526 380 600 470 610C560 620 600 470 720 450C820 434 880 560 980 580' +
    'C1080 600 1130 500 1240 490C1340 482 1400 590 1500 600C1560 606 1620 580 1650 570V1000H-50Z" fill="url(#far)"/>' +
    mist(640, 61) +
    '<path d="M-50 860C60 820 140 700 250 690C350 682 390 760 500 770C620 780 680 640 800 630C900 622 960 730 1060 745' +
    'C1180 762 1230 660 1340 655C1440 650 1520 740 1650 750V1000H-50Z" fill="url(#mid)"/>' +
    mist(790, 73) +
    '<path d="M-50 940C80 920 160 830 280 825C380 820 430 880 540 888C680 898 760 820 900 815C1020 811 1090 880 1210 888' +
    'C1340 896 1430 840 1650 850V1000H-50Z" fill="url(#near)"/>' +
    ring(view) +
    SEAL +
    `<g style="fill:var(--ink)" opacity=".86">${cane(64, 22, -3, 5)}${cane(132, 16, 2.5, 6)}${cane(22, 13, -6, 7)}</g>` +
    petals(12, 201, false) +
    (view.mood === 'idle' ? '' : working()) +
    (view.mood === 'done' ? flourish() : '')

  return frame({ at: view.at, mood: view.mood, scheme, dark: NIGHT, light: DAY, css: CSS, defs: DEFS, body })
}
