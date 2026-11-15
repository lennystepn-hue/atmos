// Atmos kit: the helpers every Atmos mod carries a copy of.
// Pure functions only, so the same file works in every mod unchanged.

import type { LookSettings, MoodKind, Scheme } from '../types'

export type { LookSettings, MoodKind, Scheme }

export const DEFAULT_SETTINGS: LookSettings = {
  isWanted: true,
  glassOpacity: 56,
  glassBlur: 9,
  isCalm: false,
  scheme: 'auto',
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Reads whatever an earlier version stored as settings, keeping only what fits. */
export function cleanSettings(raw: unknown, defaults: LookSettings = DEFAULT_SETTINGS): LookSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...defaults }
  }
  const stored = raw as Partial<Record<keyof LookSettings, unknown>>
  const scheme = stored.scheme === 'light' || stored.scheme === 'dark' ? stored.scheme : 'auto'

  return {
    isWanted: typeof stored.isWanted === 'boolean' ? stored.isWanted : defaults.isWanted,
    glassOpacity:
      typeof stored.glassOpacity === 'number' ? clamp(Math.round(stored.glassOpacity), 0, 100) : defaults.glassOpacity,
    glassBlur: typeof stored.glassBlur === 'number' ? clamp(Math.round(stored.glassBlur), 0, 64) : defaults.glassBlur,
    isCalm: typeof stored.isCalm === 'boolean' ? stored.isCalm : defaults.isCalm,
    scheme,
  }
}

/** What the look's own slash command was asked to do. */
export type LookAction =
  | { kind: 'on' }
  | { kind: 'off' }
  | { kind: 'help' }
  | { kind: 'calm'; isCalm: boolean }
  | { kind: 'scheme'; scheme: Scheme }
  | { kind: 'glass'; opacity: number; blur?: number }
  | { kind: 'other'; words: string[] }

/** Reads the words after `/<look>`; anything it doesn't know is handed back as `other`. */
export function parseLookCommand(args: string): LookAction {
  const words = args.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const [first, second, third] = words

  if (first === undefined || first === 'on') {
    return { kind: 'on' }
  }

  if (first === 'off') {
    return { kind: 'off' }
  }

  if (first === 'help' || first === '?') {
    return { kind: 'help' }
  }

  if (first === 'calm' || first === 'still') {
    return { kind: 'calm', isCalm: true }
  }

  if (first === 'live' || first === 'alive') {
    return { kind: 'calm', isCalm: false }
  }

  if (first === 'auto' || first === 'light' || first === 'dark') {
    return { kind: 'scheme', scheme: first }
  }

  if (first === 'glass' && second !== undefined && /^\d+$/.test(second)) {
    const opacity = clamp(Number(second), 0, 100)

    if (third !== undefined && /^\d+$/.test(third)) {
      return { kind: 'glass', opacity, blur: clamp(Number(third), 0, 64) }
    }

    return { kind: 'glass', opacity }
  }

  return { kind: 'other', words }
}

/** The lines every look's `/<look> help` ends with. */
export function commonHelp(name: string): string {
  return [
    `/${name}            switch to this look`,
    `/${name} off        back to the app's own look`,
    `/${name} glass 40   panels 40% opaque (0 shows the most scene, 100 hides it); add a blur 0-64: glass 40 4`,
    `/${name} calm       hold the scene still · /${name} live lets it react to Claude again`,
    `/${name} dark       force the night scene · light the day scene · auto follows the app`,
  ].join('\n')
}

/** Seconds into the UTC day, the clock every scene's loops are synced to. */
export function secondsOfDay(nowMs: number): number {
  return Math.round((nowMs % 86_400_000) / 10) / 100
}

/** 3410 -> "3,410" */
export function fmtInt(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 4_320_000 -> "1h 12m"; 95_000 -> "1m 35s"; 8_000 -> "8s" */
export function fmtDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  }

  return `${seconds}s`
}

/** 754 -> "12:34" (minutes:seconds), for a countdown. */
export function fmtClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Drawing a scene
// ---------------------------------------------------------------------------

/** A seeded random source, so a scene is the same string every time it's drawn. */
export function rng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** A short number for markup: 12.3456 -> 12.3 */
export function num(value: number, digits = 1): number {
  const scale = 10 ** digits

  return Math.round(value * scale) / scale
}

function customProperties(colors: Record<string, string | number>): string {
  return Object.entries(colors)
    .map(([name, value]) => `--${name}:${value}`)
    .join(';')
}

// What every scene's stylesheet ends with.
//  .s  a loop synced to the clock: it starts as far in as the day is old (plus
//      its own offset --o), so a scene drawn again picks up where the last one was.
//  .w  a layer that is only there while Claude works: it fades in, and fades
//      out again in the scene drawn when the turn ends.
//  .f  a flourish played once when a turn ends; each scene animates its own.
const KIT_CSS = [
  '.s{animation-delay:calc((var(--t) + var(--o,0))*-1s)!important}',
  '.w,.f{opacity:0}',
  '.m-working .w{animation:atm-in 1.8s ease-out both}',
  '.m-done .w{animation:atm-out 2.6s ease-in both}',
  '@keyframes atm-in{from{opacity:0}to{opacity:1}}',
  '@keyframes atm-out{0%{opacity:1}99%{opacity:0;visibility:visible}100%{opacity:0;visibility:hidden}}',
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}.m-working .w{opacity:1}}',
].join('')

export type Frame = {
  /** Seconds into the day when this drawing was asked for. */
  at: number
  mood: MoodKind
  scheme: Scheme
  /** The scene's colors as CSS custom properties, for night and for day. */
  dark: Record<string, string | number>
  light: Record<string, string | number>
  css: string
  defs: string
  body: string
}

/** Wraps a scene's parts into one SVG document that fills any window. */
export function frame(parts: Frame): string {
  const dark = `svg{${customProperties(parts.dark)}}`
  const light = `svg{${customProperties(parts.light)}}`
  const colors =
    parts.scheme === 'dark'
      ? dark
      : parts.scheme === 'light'
        ? light
        : `${dark}@media (prefers-color-scheme:light){${light}}`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" ` +
    `class="m-${parts.mood}" style="--t:${num(parts.at, 2)}">` +
    `<style>${colors}${parts.css}${KIT_CSS}</style><defs>${parts.defs}</defs>${parts.body}</svg>`
  )
}
