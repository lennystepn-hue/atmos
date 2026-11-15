// Forge: a smithy fire behind the conversation, and you are the one keeping it alive.
//
// Every prompt is a strike that feeds the fire, every tool call a breath from the
// bellows. Leave it alone and it burns down, over some twenty minutes, to embers
// and then to cold coals. The band above the prompt says how hot it is and how
// long you've kept it going.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs, Timer } from 'claude-code'

import { cleanSettings, commonHelp, DEFAULT_SETTINGS, parseLookCommand, secondsOfDay } from './kit'
import { problems, theme } from './palette.js'
import { drawScene, LEVELS, levelOf } from './scene'
import type { ForgeFire, ForgeView, LookSettings } from '../types'

const NAME = 'forge'
const SCENE = 'forge-fire'

/** How much a prompt and a tool call feed the fire, and how fast it cools. */
const STRIKE = 22
const BREATH = 3
const TICK_MS = 20_000
const COOLING = 1.5

const settings = atom({ plugin: 'forge', key: 'settings' } as const, DEFAULT_SETTINGS)
const view = atom({ plugin: 'forge', key: 'view' } as const, { mood: 'idle', heat: 1, at: 0 })
const isActive = atom({ plugin: 'forge', key: 'isActive' } as const, false)
const fire = atom({ plugin: 'forge', key: 'fire' } as const, { heat: 20, strikes: 0, litAt: 0, best: 0, isWorked: false })

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
async function setView($: EngineInterface, patch: Partial<Pick<ForgeView, 'mood' | 'heat'>>): Promise<void> {
  const current = await read($, view)
  const next = { ...current, ...patch }

  if (next.mood === current.mood && next.heat === current.heat) {
    return
  }
  const at = secondsOfDay(await $.clock.now())
  await update($, view, () => ({ ...next, at }))
}

function minutes(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000))

  return total < 60 ? `${total}m` : `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

/** Feeds the fire; a strike is a prompt, anything else a breath from the bellows. */
async function stoke($: EngineInterface, amount: number, isStrike: boolean): Promise<ForgeFire> {
  const now = await $.clock.now()
  const before = await read($, fire)
  const after: ForgeFire = {
    ...before,
    heat: Math.min(100, before.heat + amount),
    strikes: before.strikes + (isStrike ? 1 : 0),
    litAt: before.litAt > 0 ? before.litAt : now,
  }
  await update($, fire, () => after)
  await setView($, { heat: levelOf(after.heat) })

  return after
}

/** One tick of the clock: an untended fire burns down. */
async function cool($: EngineInterface): Promise<void> {
  if (!(await read($, isActive))) {
    return
  }
  const before = await read($, fire)

  if (before.isWorked || before.heat <= 0) {
    return
  }
  const heat = Math.max(0, before.heat - COOLING)
  const was = levelOf(before.heat)
  const level = levelOf(heat)

  if (heat > 0) {
    await update($, fire, () => ({ ...before, heat }))
  } else {
    const burned = before.litAt > 0 ? (await $.clock.now()) - before.litAt : 0
    const best = Math.max(before.best, burned)
    await update($, fire, () => ({ ...before, heat: 0, litAt: 0, best }))
    await $.store.set('best', best)
    $.ui.toast(`The forge has gone cold after ${minutes(burned)}. One prompt relights it.`, { timeoutMs: 8000 })
  }

  if (level === 1 && was === 2) {
    $.ui.toast('The fire is burning down to embers.')
  }
  await setView($, { heat: level })
}

function fireLine(current: ForgeFire, now: number): string {
  const level = LEVELS[levelOf(current.heat)] ?? 'Cold'
  const alive = current.litAt > 0 ? `alive for ${minutes(now - current.litAt)}` : 'no fire'
  const best = current.best > 0 ? ` · longest burn ${minutes(current.best)}` : ''

  return `${level} · heat ${Math.round(current.heat)} of 100 · ${alive} · ${current.strikes} strikes${best}`
}

// The one timer this mod keeps; a reload starts over with a new one.
let ticker: Timer | undefined

async function start($: EngineInterface): Promise<void> {
  const stored = await loadSettings($)
  const saved = Number((await $.store.get('best')) ?? 0)
  const now = await $.clock.now()
  const before = await read($, fire)
  const lit: ForgeFire = {
    ...before,
    best: Math.max(before.best, Number.isFinite(saved) ? saved : 0),
    litAt: before.heat > 0 && before.litAt === 0 ? now : before.litAt,
  }
  await update($, fire, () => lit)
  ticker?.cancel()
  ticker = $.clock.every(TICK_MS, () => {
    void cool($)
  })

  if (stored.isWanted) {
    await apply($)
    await setView($, { heat: levelOf(lit.heat) })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: 'Forge look: a smithy fire your prompts keep alive',
      argumentHint: '[off | stoke | glass 0-100 | calm | live | dark | light | auto | help]',
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
    if (e.agentId === undefined && (await read($, isActive))) {
      const stoked = await stoke($, STRIKE, true)
      await update($, fire, () => ({ ...stoked, isWorked: true }))

      if (!(await read($, settings)).isCalm) {
        await setView($, { mood: 'working' })
      }
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (await read($, isActive)) {
      await stoke($, BREATH, false)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && (await read($, isActive))) {
      const current = await read($, fire)
      await update($, fire, () => ({ ...current, isWorked: false }))

      if (!(await read($, settings)).isCalm) {
        await setView($, { mood: e.isAborted ? 'idle' : 'done' })
      }
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
        alt="A smithy at night: a bed of coals, flames and rising sparks, an anvil in the corner"
        isInteractive
      />
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isActive))) {
      return next(e)
    }
    const current = await read($, fire)
    const now = await $.clock.now()
    const level = levelOf(current.heat)
    const lit = Math.round(current.heat / 12.5)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" columnGap={2} alignItems="center">
        <Text weight="semibold" color={level >= 2 ? 'claude' : level === 1 ? 'warning' : 'inactive'}>
          ▲ {LEVELS[level] ?? 'Cold'}
        </Text>
        <Text color={level >= 2 ? 'claude' : 'inactive'}>
          {'▰'.repeat(lit)}
          {'▱'.repeat(8 - lit)}
        </Text>
        <Text dimColor tabular>
          {current.litAt > 0 ? `alive for ${minutes(now - current.litAt)}` : 'a prompt relights it'} · {current.strikes}{' '}
          {current.strikes === 1 ? 'strike' : 'strikes'}
          {current.best > 0 ? ` · longest burn ${minutes(current.best)}` : ''}
        </Text>
      </Box>
    )
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const action = parseLookCommand(e.args)

    if (action.kind === 'on') {
      await saveSettings($, { isWanted: true })
      const reason = await apply($)
      const current = await read($, fire)
      await setView($, { heat: levelOf(current.heat) })

      return {
        text: reason
          ? `Forge is set, but nothing draws it here: ${reason}`
          : `Forge is on. ${fireLine(current, await $.clock.now())}. /${NAME} help lists the dials.`,
      }
    }

    if (action.kind === 'off') {
      await update($, isActive, () => false)
      await saveSettings($, { isWanted: false })
      await $.theme.clear()

      return { text: "Forge is off: back to the app's own look." }
    }

    if (action.kind === 'calm') {
      await saveSettings($, { isCalm: action.isCalm })

      if (action.isCalm) {
        await setView($, { mood: 'idle' })
      }

      return {
        text: action.isCalm
          ? 'The smithy is quiet: no sparks fly while Claude works. The fire still rises and falls with you.'
          : 'The smithy is at work again: sparks off the anvil while Claude works.',
      }
    }

    if (action.kind === 'scheme') {
      await saveSettings($, { scheme: action.scheme })

      return {
        text:
          action.scheme === 'auto'
            ? 'The scene follows the app: a night smithy in dark mode, a daylight workshop in light mode.'
            : `The scene stays on its ${action.scheme === 'dark' ? 'night smithy' : 'daylight workshop'}.`,
      }
    }

    if (action.kind === 'glass') {
      const patch = action.blur === undefined ? { glassOpacity: action.opacity } : { glassOpacity: action.opacity, glassBlur: action.blur }
      const next = await saveSettings($, patch)

      if (await read($, isActive)) {
        await $.theme.set(lookOf(next))
      }

      return { text: `Panels are ${next.glassOpacity}% opaque over the fire, blurred by ${next.glassBlur}.` }
    }

    if (action.kind === 'other' && action.words[0] === 'stoke') {
      return { text: `You work the bellows. ${fireLine(await stoke($, 30, false), await $.clock.now())}.` }
    }

    if (action.kind === 'other' && action.words[0] === 'fire') {
      return { text: fireLine(await read($, fire), await $.clock.now()) }
    }

    return {
      text: [
        'Forge: a fire you keep alive. Prompts and tool calls feed it; left alone it burns down to embers, then goes cold.',
        commonHelp(NAME),
        `/${NAME} stoke      work the bellows by hand`,
        `/${NAME} fire       how the fire is doing`,
      ].join('\n'),
    }
  })
}
