// Horizon: a mountain sky behind the conversation that keeps your local time.
//
// Dawn comes up peach, noon is wide and blue, dusk burns out behind the ridge,
// and at night the stars and the northern lights come out. Because the sky
// knows what time it is, it can also tell you when you've been at it for a while
// and when it's time to call it a night.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs, Timer } from 'claude-code'

import { cleanSettings, commonHelp, DEFAULT_SETTINGS, parseLookCommand, secondsOfDay } from './kit'
import { problems, theme } from './palette.js'
import { drawScene, phaseOf } from './scene'
import type { HorizonClock, HorizonPrefs, HorizonView, LookSettings } from '../types'

const NAME = 'horizon'
const SCENE = 'horizon-sky'
const TICK_MS = 20_000
const DEFAULT_PREFS: HorizonPrefs = { breakEvery: 90, bedtime: -1, offset: 0 }

const settings = atom({ plugin: 'horizon', key: 'settings' } as const, DEFAULT_SETTINGS)
const view = atom({ plugin: 'horizon', key: 'view' } as const, { mood: 'idle', hour: 12, at: 0 })
const isActive = atom({ plugin: 'horizon', key: 'isActive' } as const, false)
const prefs = atom({ plugin: 'horizon', key: 'prefs' } as const, DEFAULT_PREFS)
const clock = atom({ plugin: 'horizon', key: 'clock' } as const, { minute: 720, startedAt: 0, nextBreakAt: 0, bedtimeDay: -1 })

function lookOf(current: LookSettings): ThemeSetArgs {
  return {
    colors: theme,
    backdrop: { scene: SCENE, glass: { blur: current.glassBlur, opacity: current.glassOpacity / 100 } },
  }
}

async function loadSettings($: EngineInterface): Promise<LookSettings> {
  const stored = cleanSettings(await $.store.get('settings'))
  await update($, settings, () => stored)

  return stored
}

async function saveSettings($: EngineInterface, patch: Partial<LookSettings>): Promise<LookSettings> {
  const next = { ...(await read($, settings)), ...patch }
  await update($, settings, () => next)
  await $.store.set('settings', next)

  return next
}

function cleanPrefs(raw: unknown): HorizonPrefs {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_PREFS }
  }
  const stored = raw as Partial<Record<keyof HorizonPrefs, unknown>>
  const within = (value: unknown, low: number, high: number, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high ? value : fallback

  return {
    breakEvery: within(stored.breakEvery, 0, 600, DEFAULT_PREFS.breakEvery),
    bedtime: within(stored.bedtime, -1, 1439, DEFAULT_PREFS.bedtime),
    offset: within(stored.offset, -14, 14, DEFAULT_PREFS.offset),
  }
}

async function savePrefs($: EngineInterface, patch: Partial<HorizonPrefs>): Promise<HorizonPrefs> {
  const next = { ...(await read($, prefs)), ...patch }
  await update($, prefs, () => next)
  await $.store.set('prefs', next)

  return next
}

/** Makes this the session's look. Resolves to why nothing draws it, or "" when something does. */
async function apply($: EngineInterface): Promise<string> {
  await update($, isActive, () => true)
  const set = await $.theme.set(lookOf(await read($, settings)))

  return set.isDrawn ? '' : set.reason
}

/** Changes what the scene is drawn from, and stamps the moment so its loops carry on in step. */
async function setView($: EngineInterface, patch: Partial<Pick<HorizonView, 'mood' | 'hour'>>): Promise<void> {
  const current = await read($, view)
  const next = { ...current, ...patch }

  if (next.mood === current.mood && next.hour === current.hour) {
    return
  }
  const at = secondsOfDay(await $.clock.now())
  await update($, view, () => ({ ...next, at }))
}

/** The local time as minutes after midnight, and the day it falls on. */
function localTime(nowMs: number, offsetHours: number): { minute: number; day: number } {
  const local = new Date(nowMs + offsetHours * 3_600_000)

  return {
    minute: local.getHours() * 60 + local.getMinutes(),
    day: Math.floor((nowMs + offsetHours * 3_600_000 - local.getTimezoneOffset() * 60_000) / 86_400_000),
  }
}

const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

function span(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000))

  return total < 60 ? `${total}m` : `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

/** Reads the clock: moves the sky to the half hour it is, and gives the reminders that are due. */
async function tick($: EngineInterface): Promise<HorizonClock> {
  const now = await $.clock.now()
  const wants = await read($, prefs)
  const before = await read($, clock)
  const { minute, day } = localTime(now, wants.offset)
  const after: HorizonClock = { ...before, minute, startedAt: before.startedAt > 0 ? before.startedAt : now }
  const isOn = await read($, isActive)

  if (wants.breakEvery <= 0) {
    after.nextBreakAt = 0
  } else if (after.nextBreakAt === 0) {
    after.nextBreakAt = now + wants.breakEvery * 60_000
  } else if (now >= after.nextBreakAt) {
    after.nextBreakAt = now + wants.breakEvery * 60_000

    if (isOn) {
      $.ui.toast(`${span(now - after.startedAt)} in. Stand up, stretch, look at a real horizon.`, { timeoutMs: 10_000 })
    }
  }

  // Due from bedtime until an hour after it, once a day, so a session opened late still hears it.
  if (wants.bedtime >= 0 && after.bedtimeDay !== day && (minute - wants.bedtime + 1440) % 1440 < 60) {
    after.bedtimeDay = day

    if (isOn) {
      $.ui.toast(`It's ${hhmm(minute)}. The stars are out: a good moment to wrap up.`, { timeoutMs: 12_000 })
    }
  }

  if (
    after.minute !== before.minute ||
    after.startedAt !== before.startedAt ||
    after.nextBreakAt !== before.nextBreakAt ||
    after.bedtimeDay !== before.bedtimeDay
  ) {
    await update($, clock, () => after)
  }

  if (isOn) {
    await setView($, { hour: Math.floor(minute / 30) / 2 })
  }

  return after
}

function skyLine(current: HorizonClock, wants: HorizonPrefs, now: number): string {
  const rest = current.nextBreakAt > 0 ? ` · next break in ${span(current.nextBreakAt - now)}` : ''
  const bed = wants.bedtime >= 0 ? ` · wrap-up at ${hhmm(wants.bedtime)}` : ''

  return `${hhmm(current.minute)} · ${phaseOf(current.minute / 60)} · in session ${span(now - current.startedAt)}${rest}${bed}`
}

// The one timer this mod keeps; a reload starts over with a new one.
let ticker: Timer | undefined

async function start($: EngineInterface): Promise<void> {
  const stored = await loadSettings($)
  const wants = cleanPrefs(await $.store.get('prefs'))
  await update($, prefs, () => wants)
  ticker?.cancel()
  ticker = $.clock.every(TICK_MS, () => {
    void tick($)
  })

  if (stored.isWanted) {
    await apply($)
  }
  await tick($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: 'Horizon look: a mountain sky that keeps your local time',
      argumentHint: '[off | breaks 90 | bedtime 23:30 | glass 0-100 | calm | live | dark | light | auto | help]',
      immediate: true,
    })
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await start($)

    return next(e)
  })

  // /clear, /resume and /branch reset $.state and fire no session.start.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await start($)

    return next(e)
  })

  // One look stands at a time. When another mod sets or clears the theme, step back.
  on('theme.set', async ($, e, next) => {
    if (next.origin.plugin !== $.plugin.name && (await read($, isActive))) {
      await update($, isActive, () => false)
      await saveSettings($, { isWanted: false })
    }

    return next(e)
  })

  on('theme.clear', async ($, e, next) => {
    if (next.origin.plugin !== $.plugin.name && (await read($, isActive))) {
      await update($, isActive, () => false)
      await saveSettings($, { isWanted: false })
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && (await read($, isActive)) && !(await read($, settings)).isCalm) {
      await setView($, { mood: 'working' })
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && (await read($, isActive)) && !(await read($, settings)).isCalm) {
      await setView($, { mood: e.isAborted ? 'idle' : 'done' })
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE) {
      return next(e)
    }

    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const current = await read($, view)
    const { scheme } = await read($, settings)

    return (
      <Svg
        source={drawScene(current, scheme)}
        alt="A mountain horizon under the sky of this hour: sun or moon, clouds or stars and northern lights"
        isInteractive
      />
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isActive))) {
      return next(e)
    }
    const current = await read($, clock)
    const wants = await read($, prefs)
    const now = await $.clock.now()
    const phase = phaseOf(current.minute / 60)
    const mark = phase === 'Dawn' ? '◓' : phase === 'Day' ? '○' : phase === 'Dusk' ? '◒' : '●'
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" columnGap={2} alignItems="center">
        <Text weight="semibold" tabular>
          {mark} {hhmm(current.minute)}
        </Text>
        <Text dimColor tabular>
          {phase} · in session {span(now - current.startedAt)}
          {current.nextBreakAt > 0 ? ` · break in ${span(current.nextBreakAt - now)}` : ''}
          {wants.bedtime >= 0 ? ` · wrap-up ${hhmm(wants.bedtime)}` : ''}
        </Text>
      </Box>
    )
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const action = parseLookCommand(e.args)

    if (action.kind === 'on') {
      await saveSettings($, { isWanted: true })
      const reason = await apply($)
      const current = await tick($)

      return {
        text: reason
          ? `Horizon is set, but nothing draws it here: ${reason}`
          : `Horizon is on. ${skyLine(current, await read($, prefs), await $.clock.now())}. /${NAME} help lists the dials.`,
      }
    }

    if (action.kind === 'off') {
      await update($, isActive, () => false)
      await saveSettings($, { isWanted: false })
      await $.theme.clear()

      return { text: "Horizon is off: back to the app's own look." }
    }

    if (action.kind === 'calm') {
      await saveSettings($, { isCalm: action.isCalm })

      if (action.isCalm) {
        await setView($, { mood: 'idle' })
      }

      return {
        text: action.isCalm
          ? 'The sky keeps the time and nothing else: it no longer reacts to Claude.'
          : 'The sky is alive again: the lights gather while Claude works.',
      }
    }

    if (action.kind === 'scheme') {
      await saveSettings($, { scheme: action.scheme })

      return {
        text:
          action.scheme === 'auto'
            ? 'The scene follows the app: deep skies in dark mode, pale ones in light mode.'
            : `The scene stays on its ${action.scheme === 'dark' ? 'deep' : 'pale'} skies.`,
      }
    }

    if (action.kind === 'glass') {
      const patch = action.blur === undefined ? { glassOpacity: action.opacity } : { glassOpacity: action.opacity, glassBlur: action.blur }
      const next = await saveSettings($, patch)

      if (await read($, isActive)) {
        await $.theme.set(lookOf(next))
      }

      return { text: `Panels are ${next.glassOpacity}% opaque over the sky, blurred by ${next.glassBlur}.` }
    }
    const [word, value] = action.kind === 'other' ? action.words : []

    if (word === 'breaks' || word === 'break') {
      const every = value === 'off' ? 0 : Number(value)

      if (!Number.isFinite(every) || every < 0 || every > 600) {
        return { text: `/${NAME} breaks 90 reminds you every 90 minutes; /${NAME} breaks off stops the reminders.` }
      }
      await savePrefs($, { breakEvery: Math.round(every) })
      const current = await read($, clock)
      await update($, clock, () => ({ ...current, nextBreakAt: 0 }))
      await tick($)

      return { text: every > 0 ? `A reminder to take a break every ${Math.round(every)} minutes.` : 'No break reminders.' }
    }

    if (word === 'bedtime' || word === 'wrap') {
      const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
      const minute = match === null ? -1 : Number(match[1]) * 60 + Number(match[2])

      if (value !== 'off' && (minute < 0 || minute > 1439)) {
        return { text: `/${NAME} bedtime 23:30 tells you when it's 23:30; /${NAME} bedtime off stops it.` }
      }
      await savePrefs($, { bedtime: value === 'off' ? -1 : minute })

      return { text: value === 'off' ? 'No wrap-up reminder.' : `The sky will tell you when it's ${hhmm(minute)}.` }
    }

    if (word === 'offset') {
      const hours = Number(value)

      if (!Number.isFinite(hours) || hours < -14 || hours > 14) {
        return { text: `/${NAME} offset 2 moves the sky's clock two hours ahead of this machine's; offset 0 puts it back.` }
      }
      await savePrefs($, { offset: hours })
      const current = await tick($)

      return { text: `The sky's clock reads ${hhmm(current.minute)}.` }
    }

    if (word === 'time') {
      return { text: skyLine(await tick($), await read($, prefs), await $.clock.now()) }
    }

    return {
      text: [
        'Horizon: a sky that keeps your local time, with a break reminder and a wrap-up time if you want them.',
        commonHelp(NAME),
        `/${NAME} breaks 90       a reminder every 90 minutes of session; breaks off for none`,
        `/${NAME} bedtime 23:30   a nudge to wrap up at that time; bedtime off for none`,
        `/${NAME} offset 2        the sky's clock two hours ahead of this machine's`,
        `/${NAME} time            what the sky reads now`,
      ].join('\n'),
    }
  })
}
