// Arcade: a neon grid behind the conversation, and a scoreboard above the prompt.
//
// Every tool call that goes through scores, and a run of them builds a combo
// that multiplies the next one; an error breaks it. Every turn is a stage, and
// clearing one writes it across the sky. The hi-score outlives the session.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { cleanSettings, commonHelp, DEFAULT_SETTINGS, fmtInt, parseLookCommand, secondsOfDay } from './kit'
import { problems, theme } from './palette.js'
import { drawScene } from './scene'
import type { ArcadeScore, ArcadeView, LookSettings } from '../types'

const NAME = 'arcade'
const SCENE = 'arcade-grid'

/** What a tool call is worth before the combo multiplies it. */
const POINTS: Record<string, number> = { Edit: 250, Write: 250, NotebookEdit: 250, Bash: 150 }
const STAGE_CLEAR = 500
const MAX_COMBO = 10

const settings = atom({ plugin: 'arcade', key: 'settings' } as const, DEFAULT_SETTINGS)
const view = atom({ plugin: 'arcade', key: 'view' } as const, { mood: 'idle', stage: 1, at: 0 })
const isActive = atom({ plugin: 'arcade', key: 'isActive' } as const, false)
const score = atom({ plugin: 'arcade', key: 'score' } as const, {
  score: 0,
  combo: 0,
  bestCombo: 0,
  stage: 1,
  hi: 0,
  toBeat: 0,
  isRecord: false,
})

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
async function setView($: EngineInterface, patch: Partial<Pick<ArcadeView, 'mood' | 'stage'>>): Promise<void> {
  const current = await read($, view)
  const next = { ...current, ...patch }

  if (next.mood === current.mood && next.stage === current.stage) {
    return
  }
  const at = secondsOfDay(await $.clock.now())
  await update($, view, () => ({ ...next, at }))
}

/** 12400 -> "012,400" */
function board(value: number): string {
  const text = String(Math.max(0, Math.round(value))).padStart(6, '0')

  return text.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Adds points and settles the hi-score. Resolves to the board after it. */
async function award($: EngineInterface, points: number, combo: number): Promise<ArcadeScore> {
  const before = await read($, score)
  const total = before.score + points
  const after: ArcadeScore = {
    ...before,
    score: total,
    combo,
    bestCombo: Math.max(before.bestCombo, combo),
    hi: Math.max(before.hi, total),
    isRecord: before.isRecord || (before.toBeat > 0 && total > before.toBeat),
  }
  await update($, score, () => after)

  if (after.isRecord && !before.isRecord) {
    $.ui.toast(`NEW HI-SCORE · ${board(total)}`, { timeoutMs: 7000 })
  }

  return after
}

function scoreLine(current: ArcadeScore): string {
  return `SCORE ${board(current.score)} · COMBO ×${current.combo} (best ×${current.bestCombo}) · HI ${board(current.hi)} · STAGE ${current.stage}`
}

async function start($: EngineInterface): Promise<void> {
  const wanted = await loadSettings($)
  const saved = Number((await $.store.get('hi')) ?? 0)
  const stored = Number.isFinite(saved) ? saved : 0
  const before = await read($, score)
  await update($, score, () => ({ ...before, hi: Math.max(before.hi, stored), toBeat: before.score === 0 ? stored : before.toBeat }))

  if (wanted.isWanted) {
    await apply($)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: 'Arcade look: a neon grid that keeps score of the session',
      argumentHint: '[off | score | reset | glass 0-100 | calm | live | dark | light | auto | help]',
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

  // The call runs first and its answer goes back untouched: this only keeps score.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)

    try {
      if (await read($, isActive)) {
        const before = await read($, score)

        if (ran.isError === true || ran.deny !== undefined) {
          await update($, score, () => ({ ...before, combo: 0 }))
        } else {
          const combo = before.combo + 1
          await award($, (POINTS[String(e.tool)] ?? 100) * Math.min(combo, MAX_COMBO), combo)
        }
      }
    } catch {
      // The scoreboard never gets in the way of a tool call.
    }

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && (await read($, isActive))) {
      const before = await read($, score)

      if (!e.isAborted) {
        const after = await award($, STAGE_CLEAR, before.combo)
        await update($, score, () => ({ ...after, stage: after.stage + 1 }))
        await $.store.set('hi', after.hi)
      }

      if (!(await read($, settings)).isCalm) {
        await setView($, e.isAborted ? { mood: 'idle' } : { mood: 'done', stage: before.stage })
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
        alt="A neon grid running to the horizon under a striped setting sun, between wireframe mountains"
        isInteractive
      />
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isActive))) {
      return next(e)
    }
    const current = await read($, score)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" columnGap={3} alignItems="center">
        <Text mono tabular weight="bold">
          SCORE {board(current.score)}
        </Text>
        <Text mono tabular weight="bold" color={current.combo >= 5 ? 'claude' : current.combo >= 2 ? 'warning' : 'inactive'}>
          COMBO ×{current.combo}
        </Text>
        <Text mono tabular dimColor>
          HI {board(current.hi)} · STAGE {current.stage}
        </Text>
      </Box>
    )
  })

  // While Claude works, the combo rides on the spinner line.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!(await read($, isActive))) {
      return next(e)
    }
    const current = await read($, score)

    if (current.combo < 2) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, suffix: `${e.props.suffix} COMBO ×${current.combo}` } })
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const action = parseLookCommand(e.args)

    if (action.kind === 'on') {
      await saveSettings($, { isWanted: true })
      const reason = await apply($)

      return {
        text: reason
          ? `Arcade is set, but nothing draws it here: ${reason}`
          : `Arcade is on. ${scoreLine(await read($, score))}. /${NAME} help lists the dials.`,
      }
    }

    if (action.kind === 'off') {
      await update($, isActive, () => false)
      await saveSettings($, { isWanted: false })
      await $.theme.clear()

      return { text: "Arcade is off: back to the app's own look." }
    }

    if (action.kind === 'calm') {
      await saveSettings($, { isCalm: action.isCalm })

      if (action.isCalm) {
        await setView($, { mood: 'idle' })
      }

      return {
        text: action.isCalm
          ? 'The grid just runs: no warp while Claude works, no banner when a stage is cleared. The score still counts.'
          : 'Warp is back while Claude works, and a cleared stage is written across the sky.',
      }
    }

    if (action.kind === 'scheme') {
      await saveSettings($, { scheme: action.scheme })

      return {
        text:
          action.scheme === 'auto'
            ? 'The scene follows the app: a night grid in dark mode, a pastel one in light mode.'
            : `The scene stays on its ${action.scheme === 'dark' ? 'night' : 'pastel'} grid.`,
      }
    }

    if (action.kind === 'glass') {
      const patch = action.blur === undefined ? { glassOpacity: action.opacity } : { glassOpacity: action.opacity, glassBlur: action.blur }
      const next = await saveSettings($, patch)

      if (await read($, isActive)) {
        await $.theme.set(lookOf(next))
      }

      return { text: `Panels are ${next.glassOpacity}% opaque over the grid, blurred by ${next.glassBlur}.` }
    }

    if (action.kind === 'other' && action.words[0] === 'score') {
      return { text: scoreLine(await read($, score)) }
    }

    if (action.kind === 'other' && action.words[0] === 'reset') {
      const before = await read($, score)
      await update($, score, () => ({ ...before, hi: before.score, toBeat: 0, isRecord: false }))
      await $.store.set('hi', before.score)

      return { text: `The hi-score is wiped. The one to beat is this session's: ${board(before.score)}.` }
    }

    return {
      text: [
        'Arcade: tool calls score (edits 250, shell 150, the rest 100), a clean run multiplies up to ×10, a cleared turn is worth 500.',
        commonHelp(NAME),
        `/${NAME} score      the board`,
        `/${NAME} reset      wipe the hi-score`,
      ].join('\n'),
    }
  })
}
