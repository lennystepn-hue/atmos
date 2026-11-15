import { expect, mock, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

/** A slash command as a person types it; the engine fills in where it came from. */
const typed = (command: string, args: string) => ({ command, args }) as never

const BACKDROP = {
  plugin: 'horizon',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'horizon-sky', plugin: 'horizon', glass: { blur: 9, opacity: 0.56 } },
} as const

const BAND = {
  plugin: 'horizon',
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

test('the band reads the local time, and a break reminder comes due', async ($, on) => {
  // Each hook here stands for the engine beneath the mod.
  mock.store(on)
  const now = Date.UTC(2026, 10, 15, 12, 0, 0)
  const clock = mock.clock(on, { now })
  const looks: ThemeSetArgs[] = []
  const toasts: string[] = []
  on('command.register', () => ({ value: { command: 'horizon' } }))
  on('theme.set', (_, e) => {
    looks.push(e)

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  const local = new Date(now)
  const time = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(looks[0]?.backdrop).toMatchObject({ scene: 'horizon-sky' })

  const scene = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const source = String((await scene.find({ type: 'Svg' }))?.props.source ?? '')
  expect(source.startsWith('<svg ')).toBe(true)
  expect(source.length).toBeLessThan(131_072)
  await scene.unmount()

  const band1 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band1.find({ type: 'Text', text: new RegExp(time) }))?.text).toContain(time)
  expect(await band1.find({ type: 'Text', text: /break in 1h 30m/ })).toBeDefined()
  await band1.unmount()

  const set = await $.command.run(typed('horizon', 'breaks 45'))
  expect(set.text).toContain('45 minutes')

  await clock.advance(46 * 60_000)
  expect(toasts.some(text => text.includes('look at a real horizon'))).toBe(true)

  const bed = await $.command.run(typed('horizon', 'bedtime 23:30'))
  expect(bed.text).toContain('23:30')
  const band2 = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band2.find({ type: 'Text', text: /wrap-up 23:30/ })).toBeDefined()
  await band2.unmount()
})
