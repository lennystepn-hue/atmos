import { expect, mock, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

const BACKDROP = {
  plugin: 'arcade',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'arcade-grid', plugin: 'arcade', glass: { blur: 9, opacity: 0.56 } },
} as const

const BAND = {
  plugin: 'arcade',
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

test('clean tool calls build a combo, an error breaks it, a cleared stage pays out', async ($, on) => {
  // Each hook here stands for the engine beneath the mod.
  mock.store(on)
  mock.clock(on, { now: 3_600_000 })
  const looks: ThemeSetArgs[] = []
  on('command.register', () => ({ value: { command: 'arcade' } }))
  on('theme.set', (_, e) => {
    looks.push(e)

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  // A refused call stands for one that failed.
  on('tool.call', (_, e) => (e.tool === 'Bash' && e.command === 'false' ? { deny: 'exit 1' } : { result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(looks[0]?.backdrop).toMatchObject({ scene: 'arcade-grid' })

  const scene = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = String((await scene.find({ type: 'Svg' }))?.props.source ?? '')
  expect(source.startsWith('<svg ')).toBe(true)
  expect(source.length).toBeLessThan(131_072)
  await scene.unmount()

  await $.turn.start({ text: 'go', turnId: 't1' })
  // Bash is worth 150: 150 + 300 + 450.
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await $.tool.call({ tool: 'Bash', command: 'date' })

  const band1 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band1.find({ type: 'Text', text: /SCORE 000,900/ })).toBeDefined()
  expect(await band1.find({ type: 'Text', text: /COMBO ×3/ })).toBeDefined()
  await band1.unmount()

  await $.tool.call({ tool: 'Bash', command: 'false' })
  await $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })

  const band2 = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band2.find({ type: 'Text', text: /SCORE 001,400/ })).toBeDefined()
  expect(await band2.find({ type: 'Text', text: /COMBO ×0/ })).toBeDefined()
  expect(await band2.find({ type: 'Text', text: /HI 001,400 · STAGE 2/ })).toBeDefined()
  await band2.unmount()

  // The cleared stage is written across the sky.
  const sky = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  expect(String((await sky.find({ type: 'Svg' }))?.props.source)).toContain('STAGE 01 CLEAR')
  await sky.unmount()
})
