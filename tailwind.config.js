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
        // Brand blue (#3463AF) and navy (#0F172A), as on hack2skill.com.
        // The scale keeps the name "plum" so every component picks it up.
        plum: {
          50: "#EFF4FF", 100: "#DFE8FD", 200: "#C8D8FF", 300: "#A9C4F5", 400: "#7FA4E6", 500: "#5583D0",
          600: "#3E6FC0", 700: "#3463AF", 800: "#2A5195", 900: "#1E3A6B", 950: "#0F172A",
        },
        // Accent: light sky blue (#86B4FF family). Named "lime" for the same reason.
        lime: {
          50: "#F2F7FF", 100: "#E4EFFF", 200: "#CCE0FF", 300: "#A9CBFF", 400: "#86B4FF", 500: "#5E97F2",
          600: "#387EF0", 700: "#2563C9", 800: "#1D4E9F", 900: "#173E7D",
        },
        ivory: "#F7F9FC",
        navy: "#0F172A",
        // Pastel card tints from the hack2skill programme cards.
        tint: {
          blue: "#EFF6FF", cream: "#FFF3DB", mint: "#F0FDFA", yellow: "#FEFCE8", lavender: "#EFECFD", sky: "#E6F4F9",
        },
        // Errors and destructive actions only.
        crimson: {
          50: "#FDF1F3", 100: "#FADFE3", 200: "#F4BBC4", 300: "#EA8C9B", 400: "#DA5A6F", 500: "#C4364B",
          600: "#AC2334", 700: "#8E1C2B", 800: "#701624", 900: "#55111C",
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
          "0%": { boxShadow: "0 0 0 0 rgba(172, 35, 52, 0.35)" },
          "100%": { boxShadow: "0 0 0 16px rgba(172, 35, 52, 0)" },
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
