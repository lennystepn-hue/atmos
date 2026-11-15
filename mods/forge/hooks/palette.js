import { makeColors } from './make-colors.js'

// The whole look from a handful of colors: makeColors fills in the other hundred.
export const DEFINITION = {
  label: 'Forge',
  roles: { accent: '#e8762b', danger: '#e0483e', success: '#7da043', warning: '#e0a52e', pro: '#c9627f' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#ece4da',
        'surface-1': '#f3ece3',
        'surface-2': '#faf5ee',
        'text-primary': '#2a1f18',
        'text-secondary': '#51443a',
        'text-muted': '#6b5d52',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#14100d',
        'surface-1': '#1c1612',
        'surface-2': '#241d18',
        'surface-3': '#2a221c',
        'text-primary': '#f3e9df',
        'text-secondary': '#d3c4b6',
        'text-muted': '#ad9c8d',
      },
    },
  },
}

export const { theme, problems } = makeColors(DEFINITION)
