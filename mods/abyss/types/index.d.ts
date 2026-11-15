export type Scheme = 'auto' | 'light' | 'dark'
export type MoodKind = 'idle' | 'working' | 'done'

/** What the look remembers between sessions. */
export type LookSettings = {
  isWanted: boolean
  glassOpacity: number
  glassBlur: number
  isCalm: boolean
  scheme: Scheme
}

/** What the scene is drawn from: `at` is seconds into the day when it last changed. */
export type AbyssView = { mood: MoodKind; zone: number; at: number }

/** The context window as the depth gauge shows it. */
export type AbyssGauge = { percent: number; tokens: number; window: number }

declare module 'claude-code' {
  interface PluginState {
    abyss: {
      settings: LookSettings
      view: AbyssView
      isActive: boolean
      gauge: AbyssGauge
    }
  }
}
