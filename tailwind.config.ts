import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brown: {
          50: "#fdf8f4",
          100: "#f6ede4",
          200: "#edd9c8",
          300: "#debfa6",
          400: "#c79e7c",
          500: "#ab7c57",
          600: "#8f6140",
          700: "#6e482f",
          800: "#4d3221",
          900: "#322016",
          950: "#1c110b",
        },
        cream: {
          50: "#fdfcf9",
          100: "#faf6ee",
          200: "#f4ecde",
          300: "#ebdec8",
          400: "#dfcbab",
          500: "#cfb58a",
          600: "#b89a69",
          700: "#987c4f",
          800: "#76613e",
          900: "#574830",
          950: "#362c1d",
        },
        // Harmonize legacy forest palette to warm dark brown so all dependent views blend
        forest: {
          50: "#fdf8f4",
          100: "#f6ede4",
          200: "#edd9c8",
          300: "#debfa6",
          400: "#c79e7c",
          500: "#ab7c57",
          600: "#8f6140",
          700: "#6e482f",
          800: "#4d3221",
          900: "#322016",
          950: "#1c110b",
        },
        charcoal: {
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        scaffold: {
          steel: "#574830",
          brass: "#c79e7c",
          safety: "#6e482f",
          danger: "#b91c1c",
          neutral: "#faf6ee",
        }
      },
      fontFamily: {
        sans: ["'Amazon Ember'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        serif: ["'Amazon Ember'", "system-ui", "sans-serif"],
        mono: ["'Amazon Ember Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
