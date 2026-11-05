/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gogreen: {
          primary: '#76FF03',
          bright: '#39FF14',
          secondary: '#00C853',
          dark: '#0B1C10',
          warning: '#F2B84B',
          error: '#FF6464',
          bg: {
            main: '#080B09',
            secondary: '#0D120F',
            panel: '#111712',
            elevated: '#18211B',
          },
          border: '#263629',
          text: {
            primary: '#E8F0EA',
            secondary: '#92A096',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'panel': '0 4px 20px -2px rgba(0, 0, 0, 0.7)',
        'glow-sm': '0 0 10px rgba(118, 255, 3, 0.15)',
        'glow-md': '0 0 20px rgba(118, 255, 3, 0.25)',
      }
    },
  },
  plugins: [],
}
