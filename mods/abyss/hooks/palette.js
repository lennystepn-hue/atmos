import { makeColors } from './make-colors.js'

// The whole look from a handful of colors: makeColors fills in the other hundred.
export const DEFINITION = {
  label: 'Abyss',
  roles: { accent: '#1aa6b7', danger: '#e0566b', success: '#2fae7d', warning: '#d79a2b', pro: '#8a6ee0' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#dceeed',
        'surface-1': '#e7f4f2',
        'surface-2': '#f2faf8',
        'text-primary': '#0e2a32',
        'text-secondary': '#2e4c55',
        'text-muted': '#4c676f',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#06121d',
        'surface-1': '#0a1a28',
        'surface-2': '#0e2233',
        'surface-3': '#122838',
        'text-primary': '#e3f3f6',
        'text-secondary': '#b5cdd5',
        'text-muted': '#8da9b3',
      },
    },
  },
}

export const { theme, problems } = makeColors(DEFINITION)
