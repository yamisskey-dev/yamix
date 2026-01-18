import daisyui from "daisyui";
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      // 標準Tailwindブレークポイント + カスタム
      sm: "640px",      // 小型タブレット
      md: "768px",      // タブレット
      lg: "1024px",     // 小型デスクトップ
      xl: "1280px",     // デスクトップ
      "2xl": "1536px",  // 大型デスクトップ
      // 後方互換性のためのエイリアス
      window: "640px",  // sm相当（旧680px）
      desktop: "1280px", // xl相当
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Hiragino Sans",
          "Hiragino Kaku Gothic ProN",
          "Noto Sans JP",
          "Meiryo",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        // NGO - NEEDY GIRL OVERDOSE inspired light theme
        light: {
          "primary": "#966BFF",           // accent
          "primary-content": "#FFFFFF",   // fgOnAccent
          "secondary": "#FF9DFF",         // buttonGradateA
          "secondary-content": "#391E60", // fg
          "accent": "#A398FF",            // buttonGradateB
          "accent-content": "#FFFFFF",
          "neutral": "#391E60",           // fg
          "neutral-content": "#FFF5FC",   // bg
          "base-100": "#FFF5FC",          // bg (rgba to hex)
          "base-200": "#FCF9FF",          // panel
          "base-300": "#FBF0FF",          // navBg
          "base-content": "#391E60",      // fg
          "info": "#3A7DFF",              // mention
          "info-content": "#FFFFFF",
          "success": "#86EFAC",           // success
          "success-content": "#391E60",
          "warning": "#FAD25A",           // warn
          "warning-content": "#391E60",
          "error": "#EB5050",             // error
          "error-content": "#FFFFFF",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "1.9rem",
        },
      },
      {
        // DXM - Dextromethorphan inspired dark theme
        dark: {
          "primary": "#A374FF",           // accent
          "primary-content": "#FFFFFF",   // fgOnAccent
          "secondary": "#B32DB6",         // buttonGradateA / indicator
          "secondary-content": "#FFFFFF",
          "accent": "#966BFF",            // buttonGradateB
          "accent-content": "#FFFFFF",
          "neutral": "#C2CBE0",           // fg
          "neutral-content": "#130E26",   // bg
          "base-100": "#130E26",          // bg (rgba to hex)
          "base-200": "#100B22",          // panel
          "base-300": "#170F2A",          // navBg
          "base-content": "#C2CBE0",      // fg
          "info": "#44A4C1",              // link color
          "info-content": "#FFFFFF",
          "success": "#79FFC2",           // success
          "success-content": "#130E26",
          "warning": "#FFAF63",           // warn
          "warning-content": "#130E26",
          "error": "#FF66C2",             // error
          "error-content": "#FFFFFF",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "1.9rem",
        },
      },
    ],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
  },
};

export default config;
