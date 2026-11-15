import { expect, mock, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

/** A slash command as a person types it; the engine fills in where it came from. */
const typed = (command: string, args: string) => ({ command, args }) as never

const BACKDROP = {
  plugin: 'abyss',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'abyss-sea', plugin: 'abyss', glass: { blur: 9, opacity: 0.56 } },
} as const

const BAND = {
  plugin: 'abyss',
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

test('a session 40% full is in the Midnight zone, drawn and measured', async ($, on) => {
  // Each hook here stands for the engine beneath the mod.
  mock.store(on)
  mock.clock(on, { now: 3_600_000 })
  const looks: ThemeSetArgs[] = []
  on('command.register', () => ({ value: { command: 'abyss' } }))
  on('theme.set', (_, e) => {
    looks.push(e)

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { percent: 40, tokens: 80_000, window: 200_000 }, rateLimits: [] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(looks.length).toBe(1)
  expect(looks[0]?.backdrop).toMatchObject({ scene: 'abyss-sea' })
  expect(looks[0]?.colors?.label).toBe('Abyss')

  const scene = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const svg = await scene.find({ type: 'Svg' })
  const source = String(svg?.props.source ?? '')
  expect(source.startsWith('<svg ')).toBe(true)
  expect(source.length).toBeLessThan(131_072)
  await scene.unmount()

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const band1 = await $.ui.mount({ ...BAND, surface })
    expect((await band1.find({ type: 'Text', text: /2,539 m/ }))?.text).toContain('2,539 m')
    expect(await band1.find({ type: 'Text', text: /Midnight zone/ })).toBeDefined()
    await band1.unmount()
  }
})

test('/abyss off clears the look and takes the gauge away', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  let cleared = 0
  on('command.register', () => ({ value: { command: 'abyss' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('theme.clear', () => {
    cleared += 1

    return { value: { isDrawn: false, reason: 'the theme is cleared' } }
  })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { percent: 10, tokens: 20_000, window: 200_000 }, rateLimits: [] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const shown = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await shown.find({ type: 'Text', text: /Twilight zone/ })).toBeDefined()
  await shown.unmount()

  const ran = await $.command.run(typed('abyss', 'off'))
  expect(ran.text).toContain('off')
  expect(cleared).toBe(1)

  const band2 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band2.find({ type: 'Text' }))?.text).toBe('engine')
  await band2.unmount()
})
