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
        sans: ["Inter var", "Inter", "system-ui", "sans-serif"],
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
        // Brand: plum (primary) + lime (signature accent) on ivory.
        plum: {
          50: "#F8F3F9", 100: "#F0E5F2", 200: "#E0CAE5", 300: "#C9A3D0", 400: "#A877B2", 500: "#87548F",
          600: "#6B3B75", 700: "#542C5F", 800: "#422249", 900: "#2F1835", 950: "#1D0E21",
        },
        lime: {
          50: "#F9FDE9", 100: "#F1FAC9", 200: "#E4F49A", 300: "#D5EE6A", 400: "#C7E848", 500: "#ADCF2C",
          600: "#87A41E", 700: "#657C19", 800: "#4F6119", 900: "#42521A",
        },
        ivory: "#F5F1E8",
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
        "toast-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.97)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.3s ease both",
        pop: "pop 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-right": "slide-in-right 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        ring: "ring 1.6s ease-out infinite",
        "toast-in": "toast-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
