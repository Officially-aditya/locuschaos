import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface-container-low": "#f3f4f5",
        "secondary": "#5f52a7",
        "surface-dim": "#d9dadb",
        "surface": "#f8f9fa",
        "on-tertiary-container": "#ffeae1",
        "on-background": "#191c1d",
        "primary-container": "#6c47ff",
        "on-surface": "#191c1d",
        "on-secondary-fixed-variant": "#47398d",
        "surface-variant": "#e1e3e4",
        "error": "#ba1a1a",
        "background": "#f8f9fa",
        "on-primary": "#ffffff",
        "tertiary-container": "#b34d00",
        "on-tertiary-fixed-variant": "#783100",
        "on-primary-fixed-variant": "#4500d8",
        "outline": "#797588",
        "inverse-surface": "#2e3132",
        "inverse-on-surface": "#f0f1f2",
        "surface-tint": "#5e35f1",
        "on-primary-fixed": "#1b0063",
        "primary-fixed-dim": "#c9beff",
        "on-secondary-fixed": "#1b0161",
        "on-primary-container": "#f1ebff",
        "error-container": "#ffdad6",
        "tertiary-fixed-dim": "#ffb691",
        "surface-container-lowest": "#ffffff",
        "secondary-fixed-dim": "#c9beff",
        "on-secondary-container": "#423487",
        "on-error-container": "#93000a",
        "primary-fixed": "#e6deff",
        "surface-container-highest": "#e1e3e4",
        "on-secondary": "#ffffff",
        "on-error": "#ffffff",
        "tertiary-fixed": "#ffdbcb",
        "on-tertiary": "#ffffff",
        "secondary-fixed": "#e6deff",
        "inverse-primary": "#c9beff",
        "primary": "#5323e6",
        "outline-variant": "#c9c3d9",
        "tertiary": "#8d3b00",
        "surface-bright": "#f8f9fa",
        "surface-container-high": "#e7e8e9",
        "on-tertiary-fixed": "#341100",
        "secondary-container": "#b0a2fd",
        "surface-container": "#edeeef",
        "on-surface-variant": "#484556"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"]
      }
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
    require('@tailwindcss/forms')
  ],
};
export default config;
