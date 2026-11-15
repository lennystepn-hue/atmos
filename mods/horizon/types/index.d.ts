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

/** What the scene is drawn from: `hour` is the local time of day, 0 to 24, in half hours. */
export type HorizonView = { mood: MoodKind; hour: number; at: number }

/** The reminders the sky gives, kept between sessions. */
export type HorizonPrefs = {
  /** Minutes of session between two reminders to take a break; 0 for none. */
  breakEvery: number
  /** The local time to wrap up at, in minutes after midnight; -1 for none. */
  bedtime: number
  /** Hours to add to the clock, for a machine whose time zone is not yours. */
  offset: number
}

/** The clock as the band shows it. */
export type HorizonClock = {
  /** Local time, in minutes after midnight. */
  minute: number
  /** When this session's sky first rose, in milliseconds. */
  startedAt: number
  /** When the next break reminder is due, in milliseconds; 0 for none. */
  nextBreakAt: number
  /** The day, counted from the epoch, the bedtime reminder was last shown on. */
  bedtimeDay: number
}

declare module 'claude-code' {
  interface PluginState {
    horizon: {
      settings: LookSettings
      view: HorizonView
      isActive: boolean
      prefs: HorizonPrefs
      clock: HorizonClock
    }
  }
}
