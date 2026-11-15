import { expect, mock, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

const BACKDROP = {
  plugin: 'forge',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'forge-fire', plugin: 'forge', glass: { blur: 9, opacity: 0.56 } },
} as const

const BAND = {
  plugin: 'forge',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('a prompt feeds the fire, and an untended fire burns down to cold', async ($, on) => {
  // Each hook here stands for the engine beneath the mod.
  mock.store(on)
  const clock = mock.clock(on, { now: 3_600_000 })
  const looks: ThemeSetArgs[] = []
  on('command.register', () => ({ value: { command: 'forge' } }))
  on('theme.set', (_, e) => {
    looks.push(e)

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(looks[0]?.backdrop).toMatchObject({ scene: 'forge-fire' })
  expect(looks[0]?.colors?.label).toBe('Forge')

  const scene = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = String((await scene.find({ type: 'Svg' }))?.props.source ?? '')
  expect(source.startsWith('<svg ')).toBe(true)
  expect(source.length).toBeLessThan(131_072)
  await scene.unmount()

  // A new session starts on embers.
  const band1 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band1.find({ type: 'Text', text: /Embers/ })).toBeDefined()
  await band1.unmount()

  // One strike: 20 + 22 is a burning fire.
  await $.turn.start({ text: 'forge me a sword', turnId: 't1' })
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })
  const band2 = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band2.find({ type: 'Text', text: /Burning/ })).toBeDefined()
  expect(await band2.find({ type: 'Text', text: /1 strike/ })).toBeDefined()
  await band2.unmount()

  // Left alone for half an hour, it goes cold.
  await clock.advance(30 * 60_000)
  const band3 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band3.find({ type: 'Text', text: /Cold/ })).toBeDefined()
  expect(await band3.find({ type: 'Text', text: /longest burn/ })).toBeDefined()
  await band3.unmount()
})
