import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        status: {
          ok: '#16a34a',
          warning: '#d97706',
          critical: '#dc2626',
        },
      },
    },
  },
  plugins: [],
}

export default config
