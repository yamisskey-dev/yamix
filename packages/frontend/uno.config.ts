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
      // やみなべのブランドカラー（紫）
      primary: {
        DEFAULT: '#9333ea',
        50: '#faf5ff',
        100: '#f3e8ff',
        200: '#e9d5ff',
        300: '#d8b4fe',
        400: '#c084fc',
        500: '#a855f7',
        600: '#9333ea',
        700: '#7e22ce',
        800: '#6b21a8',
        900: '#581c87',
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
