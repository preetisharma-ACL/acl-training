/** @type {import('tailwindcss').Config} */

// Surface colours are CSS variables (see src/index.css) so one class works in
// both themes: `bg-surface`, `text-ink`, `border-line`… Brand colours are fixed.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // DM Sans, as on hack2skill.com.
        sans: ['"DM Sans"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
      colors: {
        canvas: v("canvas"),
        surface: v("surface"),
        sunken: v("sunken"),
        line: v("line"),
        "line-strong": v("line-strong"),
        ink: v("ink"),
        "ink-2": v("ink-2"),
        muted: v("muted"),
        // Brand: the Aajneeti logo crimson (700 = #AC2334). The scale keeps
        // the name "plum" so every component picks it up.
        plum: {
          50: "#FDF2F3", 100: "#FBE4E7", 200: "#F6C9CF", 300: "#EDA1AB", 400: "#DE6B7A", 500: "#CC4255",
          600: "#BC2D40", 700: "#AC2334", 800: "#8E1C2B", 900: "#6E1622", 950: "#2E0A10",
        },
        // Accent: the warm orange of the login scene's silk (400 = #F89B62).
        // Named "lime" for the same reason.
        lime: {
          50: "#FFF7F0", 100: "#FFEDDF", 200: "#FFD6BA", 300: "#FDBB8E", 400: "#F89B62", 500: "#EF7D3E",
          600: "#DC6326", 700: "#B94E1D", 800: "#943E1B", 900: "#773419",
        },
        ivory: "#FFF9F4",
        // Deep wine-black for dark text and panels (name kept).
        navy: "#2A0F14",
        // Pastel card tints, warmed to sit with the brand. Names kept.
        tint: {
          blue: "#FDEFEF", cream: "#FFF3DB", mint: "#EEF8F3", yellow: "#FEF8E5", lavender: "#F7EEF5", sky: "#FFF1E6",
        },
        // Errors and destructive actions only: a brighter rose-red, kept
        // distinct from the wine-red brand.
        crimson: {
          50: "#FFF1F2", 100: "#FFE4E6", 200: "#FECDD3", 300: "#FDA4AF", 400: "#FB7185", 500: "#F43F5E",
          600: "#E11D48", 700: "#BE123C", 800: "#9F1239", 900: "#881337",
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        float: "var(--shadow-float)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        pop: {
          from: { opacity: "0", transform: "scale(0.95) translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "none" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        ring: {
          "0%": { boxShadow: "0 0 0 0 rgba(225, 29, 72, 0.35)" },
          "100%": { boxShadow: "0 0 0 16px rgba(225, 29, 72, 0)" },
        },
        sheet: {
          from: { transform: "translateY(100%)" },
          to: { transform: "none" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.97)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards",
        "fade-in": "fade-in 0.3s ease both",
        pop: "pop 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-right": "slide-in-right 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        ring: "ring 1.6s ease-out infinite",
        "toast-in": "toast-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        sheet: "sheet 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
