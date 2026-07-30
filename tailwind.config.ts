import type { Config } from "tailwindcss";

/**
 * Two ramps, deliberately: `ink` for every neutral and `brand` for anything the
 * user can act on. Naming them by role rather than by hue is what keeps the app
 * looking like one product — a component asks for `brand-600` and gets the accent,
 * wherever the accent happens to land.
 *
 * `ink` is a cool neutral rather than pure grey, so text and surfaces sit together
 * instead of looking washed out next to the brand teal.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f8fb",
          100: "#eef1f7",
          200: "#dde3ec",
          300: "#c1cbda",
          400: "#93a1b8",
          500: "#6c7b95",
          600: "#4f5e77",
          700: "#3d4a60",
          800: "#2a3446",
          900: "#161e2c",
          950: "#0b111c",
        },
        brand: {
          50: "#eefbf6",
          100: "#d2f5e7",
          200: "#a8e9d2",
          300: "#71d7b7",
          400: "#3cbe99",
          500: "#18a37e",
          600: "#0a8365",
          700: "#096953",
          800: "#0a5443",
          900: "#094638",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        // One soft, low-contrast elevation used everywhere, plus a lifted variant
        // for pressable surfaces. More than two would read as noise.
        card: "0 1px 2px rgba(11, 17, 28, 0.04), 0 4px 16px -6px rgba(11, 17, 28, 0.10)",
        lift: "0 2px 4px rgba(11, 17, 28, 0.05), 0 12px 28px -10px rgba(11, 17, 28, 0.18)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.28s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
