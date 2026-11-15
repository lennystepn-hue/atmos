import type { ThemeColors } from 'claude-code'

/** The look's colors for both modes, ready for `$.theme.set({ colors })`. */
export const theme: ThemeColors

/** What the design system says about them; a line starting "Desktop won't paint" is fatal. */
export const problems: string[]
