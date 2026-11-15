import { makeColors } from './make-colors.js'

// The whole look from a handful of colors: makeColors fills in the other hundred.
export const DEFINITION = {
  label: 'Arcade',
  roles: { accent: '#ff3fa4', danger: '#ff4d5e', success: '#19d9a0', warning: '#ffc233', pro: '#7c5cff' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#f1e6f5',
        'surface-1': '#f6eef9',
        'surface-2': '#fbf6fd',
        'text-primary': '#2a1438',
        'text-secondary': '#4d3760',
        'text-muted': '#69557b',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#100720',
        'surface-1': '#170b2b',
        'surface-2': '#1e1036',
        'surface-3': '#23143d',
        'text-primary': '#f4e9ff',
        'text-secondary': '#cdbbe6',
        'text-muted': '#a593c2',
      },
    },
  },
}

export const { theme, problems } = makeColors(DEFINITION)
