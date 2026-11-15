// Abyss: a living ocean behind the conversation.
//
// The context window is the depth. A fresh session floats in sunlit shallows;
// as the window fills, the water darkens through the real ocean zones down to
// the hadal trench, and /compact brings you back up. While Claude works the
// deep lights up, and a whale passes when a turn is done.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { cleanSettings, commonHelp, DEFAULT_SETTINGS, fmtInt, parseLookCommand, secondsOfDay } from './kit'
import { problems, theme } from './palette.js'
import { depthOf, drawScene, SEA_FLOOR, zoneOf, ZONES } from './scene'
import type { AbyssGauge, AbyssView, LookSettings } from '../types'

const NAME = 'abyss'
const SCENE = 'abyss-sea'

const settings = atom({ plugin: 'abyss', key: 'settings' } as const, DEFAULT_SETTINGS)
const view = atom({ plugin: 'abyss', key: 'view' } as const, { mood: 'idle', zone: 0, at: 0 })
const isActive = atom({ plugin: 'abyss', key: 'isActive' } as const, false)
const gauge = atom({ plugin: 'abyss', key: 'gauge' } as const, { percent: 0, tokens: 0, window: 0 })

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

/** Changes what the scene is drawn from, and stamps the moment so its loops carry on in step. */
async function setView($: EngineInterface, patch: Partial<Pick<AbyssView, 'mood' | 'zone'>>): Promise<void> {
  const current = await read($, view)
  const next = { ...current, ...patch }

  if (next.mood === current.mood && next.zone === current.zone) {
    return
  }
  const at = secondsOfDay(await $.clock.now())
  await update($, view, () => ({ ...next, at }))
}

/** Takes a sounding: reads the context window and moves the scene to the zone it is in. */
async function sound($: EngineInterface, shouldAnnounce: boolean): Promise<AbyssGauge> {
  const before = await read($, gauge)
  let reading = before

  try {
    const { context } = await $.session.usage()
    reading = { percent: context.percent ?? 0, tokens: context.tokens ?? 0, window: context.window }
  } catch {
    return before
  }

  if (reading.percent !== before.percent || reading.tokens !== before.tokens || reading.window !== before.window) {
    await update($, gauge, () => reading)
  }
  const zone = zoneOf(depthOf(reading.percent))
  const was = (await read($, view)).zone
  await setView($, { zone })
  const entered = ZONES[zone]

  if (shouldAnnounce && entered !== undefined && zone > was) {
    $.ui.toast(`Entering the ${entered.name} · ${fmtInt(entered.from)} m`)
  }

  if (shouldAnnounce && entered !== undefined && zone < was) {
    $.ui.toast(`Surfaced to the ${entered.name}`)
  }

  if (shouldAnnounce && reading.percent >= 85 && before.percent < 85) {
    $.ui.toast('Crush depth ahead. /compact brings you back up.', { timeoutMs: 8000 })
  }

  return reading
}

function depthLine(reading: AbyssGauge): string {
  const depth = depthOf(reading.percent)
  const zone = ZONES[zoneOf(depth)]

  return `${fmtInt(depth)} m of ${fmtInt(SEA_FLOOR)} · ${zone?.name ?? ''} · ${reading.percent}% of the context window used`
}

async function start($: EngineInterface): Promise<void> {
  const stored = await loadSettings($)

  if (stored.isWanted) {
    await apply($)
    await sound($, false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: 'Abyss look: a living ocean whose depth is your context window',
      argumentHint: '[off | glass 0-100 | calm | live | dark | light | auto | help]',
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
    if (e.agentId === undefined && (await read($, isActive))) {
      if (!(await read($, settings)).isCalm) {
        await setView($, { mood: e.isAborted ? 'idle' : 'done' })
      }
      await sound($, true)
    }

    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const compacted = await next(e)

    if (await read($, isActive)) {
      await sound($, true)
    }

    return compacted
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
        alt="Open water: light falling from the surface, drifting plankton and jellyfish"
        isInteractive
      />
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isActive))) {
      return next(e)
    }
    const reading = await read($, gauge)
    const depth = depthOf(reading.percent)
    const zone = ZONES[zoneOf(depth)]
    const left = reading.window > 0 ? Math.max(0, reading.window - reading.tokens) : 0
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" columnGap={2} alignItems="center">
        <Text
          weight="semibold"
          tabular
          color={reading.percent >= 85 ? 'error' : reading.percent >= 60 ? 'warning' : 'text'}
        >
          ▾ {fmtInt(depth)} m
        </Text>
        <Text dimColor>
          {zone?.name ?? 'Open water'} · {reading.percent}% of the context window
          {left > 0 ? ` · ${fmtInt(left / 1000)}k tokens of air left` : ''}
        </Text>
        {reading.percent >= 55 && (
          <Button
            key="surface"
            label="Surface"
            onPress={async () => {
              try {
                await $.command.run({ command: 'compact', args: '' })
              } catch {
                $.ui.toast('Type /compact to surface.')
              }
            }}
          />
        )}
      </Box>
    )
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const action = parseLookCommand(e.args)

    if (action.kind === 'on') {
      await saveSettings($, { isWanted: true })
      const reason = await apply($)
      const reading = await sound($, false)

      return {
        text: reason
          ? `Abyss is set, but nothing draws it here: ${reason}`
          : `Abyss is on. ${depthLine(reading)}. /${NAME} help lists the dials.`,
      }
    }

    if (action.kind === 'off') {
      await update($, isActive, () => false)
      await saveSettings($, { isWanted: false })
      await $.theme.clear()

      return { text: "Abyss is off: back to the app's own look." }
    }

    if (action.kind === 'calm') {
      await saveSettings($, { isCalm: action.isCalm })

      if (action.isCalm) {
        await setView($, { mood: 'idle' })
      }

      return {
        text: action.isCalm
          ? 'The water holds still: the scene no longer reacts to Claude.'
          : 'The water is alive again: it lights up while Claude works.',
      }
    }

    if (action.kind === 'scheme') {
      await saveSettings($, { scheme: action.scheme })

      return {
        text:
          action.scheme === 'auto'
            ? 'The scene follows the app: night water in dark mode, a lagoon in light mode.'
            : `The scene stays on its ${action.scheme === 'dark' ? 'night water' : 'daylight lagoon'}.`,
      }
    }

    if (action.kind === 'glass') {
      const patch = action.blur === undefined ? { glassOpacity: action.opacity } : { glassOpacity: action.opacity, glassBlur: action.blur }
      const next = await saveSettings($, patch)

      if (await read($, isActive)) {
        await $.theme.set(lookOf(next))
      }

      return { text: `Panels are ${next.glassOpacity}% opaque over the water, blurred by ${next.glassBlur}.` }
    }

    if (action.kind === 'other' && action.words[0] === 'depth') {
      return { text: depthLine(await sound($, false)) }
    }

    return {
      text: [
        'Abyss: your context window is the depth. The fuller it gets, the deeper and darker the water.',
        commonHelp(NAME),
        `/${NAME} depth      how deep this session is`,
      ].join('\n'),
    }
  })
}
