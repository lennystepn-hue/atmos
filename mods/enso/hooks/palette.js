import { makeColors } from './make-colors.js'

// The whole look from a handful of colors: makeColors fills in the other hundred.
export const DEFINITION = {
  label: 'Enso',
  roles: { accent: '#3d5f8c', danger: '#c8402c', success: '#5c7f4a', warning: '#b0802a', pro: '#8a5a8f' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#ebe5d6',
        'surface-1': '#f1ecdf',
        'surface-2': '#f8f4ea',
        'text-primary': '#211e1a',
        'text-secondary': '#4a453d',
        'text-muted': '#655f55',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#141413',
        'surface-1': '#1b1b19',
        'surface-2': '#232320',
        'surface-3': '#282825',
        'text-primary': '#ece8dd',
        'text-secondary': '#c9c4b7',
        'text-muted': '#a39e92',
      },
    },
  },
}

export const { theme, problems } = makeColors(DEFINITION)
