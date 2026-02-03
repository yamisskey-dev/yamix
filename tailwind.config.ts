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
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "slide-in-bottom": "slideInBottom 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scaleIn 0.2s ease-out",
        "bounce-in": "bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "dropdown-in": "dropdownIn 0.15s ease-out",
        "float-up": "float-up 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "shimmer": "shimmer 2s infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "page-enter": "page-enter 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "ripple": "ripple 600ms cubic-bezier(0.4, 0, 0.2, 1)",
        "focus-ring-pulse": "focus-ring-pulse 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInBottom: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        bounceIn: {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        dropdownIn: {
          "0%": { opacity: "0", transform: "translateY(-4px) scale(0.95)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(163, 116, 255, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(163, 116, 255, 0.6)" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "page-enter": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        ripple: {
          "0%": { transform: "scale(0)", opacity: "0.6" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
        "focus-ring-pulse": {
          "0%": { boxShadow: "0 0 0 0px var(--background), 0 0 0 0px var(--accent-purple)" },
          "100%": { boxShadow: "0 0 0 3px var(--background), 0 0 0 5px var(--accent-purple)" },
        },
      },
      boxShadow: {
        soft: "0 2px 8px -1px rgba(0, 0, 0, 0.08), 0 1px 4px -1px rgba(0, 0, 0, 0.04)",
        elevated: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        "glow-purple": "0 4px 14px rgba(163, 116, 255, 0.25), 0 2px 6px rgba(163, 116, 255, 0.15)",
        "glow-pink": "0 4px 14px rgba(179, 45, 182, 0.25), 0 2px 6px rgba(179, 45, 182, 0.15)",
        "card-hover": "0 10px 20px -5px rgba(163, 116, 255, 0.15), 0 4px 8px -2px rgba(0, 0, 0, 0.1)",
      },
      backdropBlur: {
        xs: "2px",
        strong: "24px",
        medium: "12px",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        elastic: "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
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
          "base-100": "#FFF5FC",          // bg (NGO: rgba(255, 245, 252, 0.95))
          "base-200": "#FCF9FF",          // panel (NGO: rgba(252, 249, 255, 0.85))
          "base-300": "#FBF0FF",          // navBg (NGO: rgba(251, 240, 255, 0.98))
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
          "base-100": "#130E26",          // bg (DXM: rgba(19, 14, 38, 0.94))
          "base-200": "#100B22",          // panel (DXM: rgba(16, 11, 34, 0.86))
          "base-300": "#170F2A",          // navBg (DXM: rgba(23, 15, 42, 0.92))
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
