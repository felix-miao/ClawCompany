import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#FF5833",
          50: "#FFF0EC",
          100: "#FFE1D9",
          200: "#FFC3B3",
          300: "#FFA58D",
          400: "#FF8767",
          500: "#FF5833",
          600: "#E64A28",
          700: "#CC3B1E",
          800: "#B32D14",
          900: "#991F0A",
        },
        dark: {
          DEFAULT: "#0a0a0a",
          50: "#1a1a1a",
          100: "#2a2a2a",
          200: "#3a3a3a",
          300: "#4a4a4a",
          400: "#5a5a5a",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(255, 88, 51, 0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(255, 88, 51, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
