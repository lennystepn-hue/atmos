import { expect, mock, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

/** A slash command as a person types it; the engine fills in where it came from. */
const typed = (command: string, args: string) => ({ command, args }) as never

const BACKDROP = {
  plugin: 'enso',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'enso-garden', plugin: 'enso', glass: { blur: 9, opacity: 0.56 } },
} as const

const BAND = {
  plugin: 'enso',
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

test('a sitting counts down, paints the circle and closes it', async ($, on) => {
  // Each hook here stands for the engine beneath the mod.
  mock.store(on)
  const clock = mock.clock(on, { now: 3_600_000 })
  const looks: ThemeSetArgs[] = []
  const toasts: string[] = []
  on('command.register', () => ({ value: { command: 'enso' } }))
  on('theme.set', (_, e) => {
    looks.push(e)

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(looks[0]?.backdrop).toMatchObject({ scene: 'enso-garden' })

  const scene = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = String((await scene.find({ type: 'Svg' }))?.props.source ?? '')
  expect(source.startsWith('<svg ')).toBe(true)
  expect(source.length).toBeLessThan(131_072)
  await scene.unmount()

  const begun = await $.command.run(typed('enso', '25'))
  expect(begun.text).toContain('25 minutes')

  // The scene now paints the circle over 1500 seconds.
  const garden = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  expect(String((await garden.find({ type: 'Svg' }))?.props.source)).toContain('--n:1500s')
  await garden.unmount()

  await clock.advance(10 * 60_000)
  const band1 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band1.find({ type: 'Text', text: /15 min/ })).toBeDefined()
  await band1.unmount()

  await clock.advance(16 * 60_000)
  expect(toasts.some(text => text.includes('The circle is closed'))).toBe(true)
  const band2 = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band2.find({ type: 'Text', text: /1 circle painted/ })).toBeDefined()
  await band2.unmount()
})
