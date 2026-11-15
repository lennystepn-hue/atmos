import { makeColors } from './make-colors.js'

// The whole look from a handful of colors: makeColors fills in the other hundred.
export const DEFINITION = {
  label: 'Horizon',
  roles: { accent: '#5b7fe6', danger: '#e05a6e', success: '#3fa87a', warning: '#dc9a3a', pro: '#9a6fe0' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#e6ecf6',
        'surface-1': '#eef2fa',
        'surface-2': '#f7f9fd',
        'text-primary': '#182238',
        'text-secondary': '#3b4763',
        'text-muted': '#58647f',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b1022',
        'surface-1': '#11172d',
        'surface-2': '#171e38',
        'surface-3': '#1b2340',
        'text-primary': '#e8ecfa',
        'text-secondary': '#bcc4de',
        'text-muted': '#939cba',
      },
    },
  },
}

export const { theme, problems } = makeColors(DEFINITION)
