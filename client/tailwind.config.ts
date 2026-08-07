import type { Config } from 'tailwindcss'

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        nyvara: {
          gold: '#C5A059',
          charcoal: '#1A1A1A',
          error: '#d32f2f',
          success: '#22c55e',
        }
      }
    },
  },
  plugins: [],
} satisfies Config
