import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
  theme: {
    colors: {
      // メンヘラ.jpのブランドカラー
      primary: {
        DEFAULT: '#ff6666',
        50: '#fff5f5',
        100: '#ffe3e3',
        200: '#ffc9c9',
        300: '#ffa8a8',
        400: '#ff8787',
        500: '#ff6666',
        600: '#ff4c4c',
        700: '#ff3333',
        800: '#f51111',
        900: '#cc0000',
      },
    },
  },
  shortcuts: {
    // Common shortcuts
    'btn': 'px-4 py-2 rounded cursor-pointer transition',
    'btn-primary': 'btn bg-primary text-white hover:bg-primary-600',
    'btn-secondary': 'btn bg-gray-200 text-gray-800 hover:bg-gray-300',
    'card': 'bg-white rounded-lg shadow-md p-6',
    'input': 'w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary',
  },
})
