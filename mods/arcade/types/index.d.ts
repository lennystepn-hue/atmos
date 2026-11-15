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

/** What the scene is drawn from: `stage` is the stage just cleared, written across the sky. */
export type ArcadeView = { mood: MoodKind; stage: number; at: number }

/** The scoreboard. */
export type ArcadeScore = {
  score: number
  /** Tool calls in a row that went through; an error breaks it. */
  combo: number
  bestCombo: number
  /** The stage being played: one turn is one stage. */
  stage: number
  /** The highest score of any session. */
  hi: number
  /** The hi-score this session started against; 0 when there was none. */
  toBeat: number
  /** True once this session has beaten the score it started against. */
  isRecord: boolean
}

declare module 'claude-code' {
  interface PluginState {
    arcade: {
      settings: LookSettings
      view: ArcadeView
      isActive: boolean
      score: ArcadeScore
    }
  }
}
