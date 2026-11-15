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

/** What the scene is drawn from: `heat` is the fire's level, 0 (cold) to 4 (white-hot). */
export type ForgeView = { mood: MoodKind; heat: number; at: number }

/** The fire itself: how hot it is (0 to 100), and how long it has been kept alive. */
export type ForgeFire = {
  heat: number
  /** Prompts sent this session: each one is a strike that feeds the fire. */
  strikes: number
  /** When the fire was last lit, in milliseconds; 0 while it is cold. */
  litAt: number
  /** The longest the fire was ever kept alive, in milliseconds. */
  best: number
  /** True while a turn runs: a fire being worked doesn't cool. */
  isWorked: boolean
}

declare module 'claude-code' {
  interface PluginState {
    forge: {
      settings: LookSettings
      view: ForgeView
      isActive: boolean
      fire: ForgeFire
    }
  }
}
