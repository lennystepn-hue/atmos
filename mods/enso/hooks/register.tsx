// Ensō: an ink-wash garden behind the conversation, and a focus timer you can see.
//
// /enso 25 begins a sitting of 25 minutes. Over that time a brush circle paints
// itself in the corner of the scene; when it closes, the sitting is done. No
// numbers ticking in your face, just a circle slowly coming round.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs, Timer } from 'claude-code'

import { cleanSettings, commonHelp, DEFAULT_SETTINGS, parseLookCommand, secondsOfDay } from './kit'
import { problems, theme } from './palette.js'
import { drawScene } from './scene'
import type { EnsoFocus, EnsoSitting, EnsoView, LookSettings } from '../types'

const NAME = 'enso'
const SCENE = 'enso-garden'
const TICK_MS = 15_000
const USUAL_MINUTES = 25

const settings = atom({ plugin: 'enso', key: 'settings' } as const, DEFAULT_SETTINGS)
const view = atom({ plugin: 'enso', key: 'view' } as const, { mood: 'idle', focus: null, at: 0 })
const isActive = atom({ plugin: 'enso', key: 'isActive' } as const, false)
const sitting = atom({ plugin: 'enso', key: 'sitting' } as const, null)
const completed = atom({ plugin: 'enso', key: 'completed' } as const, 0)

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

/** Makes this the session's look. Resolves to why nothing draws it, or "" when something does. */
async function apply($: EngineInterface): Promise<string> {
  await update($, isActive, () => true)
  const set = await $.theme.set(lookOf(await read($, settings)))

  return set.isDrawn ? '' : set.reason
}

const sameFocus = (a: EnsoFocus | null, b: EnsoFocus | null) =>
  a === b || (a !== null && b !== null && a.startedAt === b.startedAt && a.seconds === b.seconds)

/** Changes what the scene is drawn from, and stamps the moment so its loops carry on in step. */
async function setView($: EngineInterface, patch: Partial<Pick<EnsoView, 'mood' | 'focus'>>): Promise<void> {
  const current = await read($, view)
  const next = { ...current, ...patch }

  if (next.mood === current.mood && sameFocus(next.focus, current.focus)) {
    return
  }
  const at = secondsOfDay(await $.clock.now())
  await update($, view, () => ({ ...next, at }))
}

/** Begins a sitting: the band counts it down and the scene starts painting the circle. */
async function sit($: EngineInterface, minutes: number): Promise<EnsoSitting> {
  const now = await $.clock.now()
  const begun: EnsoSitting = { endsAt: now + minutes * 60_000, minutes, left: minutes }
  await update($, sitting, () => begun)
  await setView($, { focus: { startedAt: secondsOfDay(now), seconds: minutes * 60 } })

  return begun
}

async function rise($: EngineInterface): Promise<void> {
  await update($, sitting, () => null)
  await setView($, { focus: null })
}

/** One tick of the clock: counts the sitting down, and closes it when the circle has come round. */
async function tick($: EngineInterface): Promise<void> {
  const current = await read($, sitting)

  if (current === null) {
    return
  }
  const now = await $.clock.now()

  if (now < current.endsAt) {
    const left = Math.ceil((current.endsAt - now) / 60_000)

    if (left !== current.left) {
      await update($, sitting, () => ({ ...current, left }))
      // Draw the scene again each minute, so the circle advances even where the app holds scenes still.
      const drawn = await read($, view)
      await update($, view, () => ({ ...drawn, at: secondsOfDay(now) }))
    }

    return
  }
  const count = (await read($, completed)) + 1
  await update($, completed, () => count)
  await $.store.set('completed', count)
  await rise($)
  $.ui.toast(`The circle is closed: ${current.minutes} minutes of focus. Ensō ${count}. Breathe before the next one.`, {
    timeoutMs: 12_000,
  })
}

// The one timer this mod keeps; a reload starts over with a new one.
let ticker: Timer | undefined

async function start($: EngineInterface): Promise<void> {
  const stored = await loadSettings($)
  const saved = Number((await $.store.get('completed')) ?? 0)
  const count = Math.max(await read($, completed), Number.isFinite(saved) ? saved : 0)
  await update($, completed, () => count)
  ticker?.cancel()
  ticker = $.clock.every(TICK_MS, () => {
    void tick($)
  })

  if (stored.isWanted) {
    await apply($)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: 'Ensō look: an ink garden with a focus timer that paints a circle',
      argumentHint: '[25 | stop | off | glass 0-100 | calm | live | dark | light | auto | help]',
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
        alt="An ink-wash garden: misty mountains, bamboo, falling petals and a brush circle"
        isInteractive
      />
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isActive))) {
      return next(e)
    }
    const current = await read($, sitting)
    const count = await read($, completed)
    const { Box, Button, Text } = $.ui.resolve(e)

    if (current === null) {
      return (
        <Box flexDirection="row" columnGap={2} alignItems="center">
          <Text dimColor>
            ◯ {count === 0 ? 'No circle painted yet' : `${count} ${count === 1 ? 'circle' : 'circles'} painted`}
          </Text>
          <Button
            key="sit"
            label={`Sit for ${USUAL_MINUTES} min`}
            onPress={async () => {
              await sit($, USUAL_MINUTES)
            }}
          />
        </Box>
      )
    }

    return (
      <Box flexDirection="row" columnGap={2} alignItems="center">
        <Text weight="semibold" tabular>
          ◯ {current.left} min
        </Text>
        <Text dimColor>left of a {current.minutes}-minute sitting: the circle is coming round</Text>
        <Button
          key="rise"
          label="End"
          onPress={async () => {
            await rise($)
          }}
        />
      </Box>
    )
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const action = parseLookCommand(e.args)

    if (action.kind === 'on') {
      await saveSettings($, { isWanted: true })
      const reason = await apply($)

      return {
        text: reason
          ? `Ensō is set, but nothing draws it here: ${reason}`
          : `Ensō is on. /${NAME} ${USUAL_MINUTES} begins a sitting; /${NAME} help lists the dials.`,
      }
    }

    if (action.kind === 'off') {
      await update($, isActive, () => false)
      await saveSettings($, { isWanted: false })
      await $.theme.clear()

      return { text: "Ensō is off: back to the app's own look." }
    }

    if (action.kind === 'calm') {
      await saveSettings($, { isCalm: action.isCalm })

      if (action.isCalm) {
        await setView($, { mood: 'idle' })
      }

      return {
        text: action.isCalm
          ? 'The garden is still: nothing passes through while Claude works. The circle still paints.'
          : 'The garden stirs again: a breeze and three cranes while Claude works.',
      }
    }

    if (action.kind === 'scheme') {
      await saveSettings($, { scheme: action.scheme })

      return {
        text:
          action.scheme === 'auto'
            ? 'The scene follows the app: night ink in dark mode, ink on paper in light mode.'
            : `The scene stays ${action.scheme === 'dark' ? 'night ink' : 'ink on paper'}.`,
      }
    }

    if (action.kind === 'glass') {
      const patch = action.blur === undefined ? { glassOpacity: action.opacity } : { glassOpacity: action.opacity, glassBlur: action.blur }
      const next = await saveSettings($, patch)

      if (await read($, isActive)) {
        await $.theme.set(lookOf(next))
      }

      return { text: `Panels are ${next.glassOpacity}% opaque over the garden, blurred by ${next.glassBlur}.` }
    }
    const words = action.kind === 'other' ? action.words : []
    const first = words[0] === 'sit' || words[0] === 'focus' ? (words[1] ?? String(USUAL_MINUTES)) : words[0]

    if (first === 'stop' || first === 'end' || first === 'rise') {
      const current = await read($, sitting)
      await rise($)

      return { text: current === null ? 'No sitting to end.' : 'The sitting is ended. The circle stands whole again.' }
    }

    if (first !== undefined && /^\d+$/.test(first)) {
      const minutes = Number(first)

      if (minutes < 1 || minutes > 240) {
        return { text: `A sitting is 1 to 240 minutes: /${NAME} 25.` }
      }
      await sit($, minutes)

      return {
        text: `A sitting of ${minutes} minutes begins. Watch the circle in the corner: when it closes, you're done. /${NAME} stop ends it early.`,
      }
    }

    return {
      text: [
        'Ensō: a focus timer drawn as a brush circle. It paints itself over the sitting and closes when the time is up.',
        `/${NAME} 25         begin a sitting of 25 minutes (any length from 1 to 240)`,
        `/${NAME} stop       end the sitting early`,
        commonHelp(NAME),
      ].join('\n'),
    }
  })
}
