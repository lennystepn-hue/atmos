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

/** A sitting as the scene paints it: when it began, in seconds into the day, and how long it runs. */
export type EnsoFocus = { startedAt: number; seconds: number }

/** What the scene is drawn from. With a `focus`, the circle paints itself over that time. */
export type EnsoView = { mood: MoodKind; focus: EnsoFocus | null; at: number }

/** A sitting as the band counts it down. */
export type EnsoSitting = {
  /** When it ends, in milliseconds. */
  endsAt: number
  /** How long it was set for, and how much of that is left, in minutes. */
  minutes: number
  left: number
}

declare module 'claude-code' {
  interface PluginState {
    enso: {
      settings: LookSettings
      view: EnsoView
      isActive: boolean
      sitting: EnsoSitting | null
      /** Circles completed, over every session. */
      completed: number
    }
  }
}
