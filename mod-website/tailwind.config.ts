import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdbff",
          300: "#8ec4ff",
          400: "#59a4ff",
          500: "#3282ff",
          600: "#1b62f5",
          700: "#144de1",
          800: "#173eb6",
          900: "#19398f",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "cursor-blink": "cursor-blink 1.1s step-end infinite",
      },
      keyframes: {
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(180deg, #f5faff 0%, #eaf4ff 45%, #ffffff 100%)",
        "grid-fade":
          "linear-gradient(to right, rgba(30,64,175,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,64,175,0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
export default config;
