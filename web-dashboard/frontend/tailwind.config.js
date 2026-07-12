/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkBg: '#09090b',
        darkCard: 'rgba(24, 24, 27, 0.65)',
        lightBg: '#fafafa',
        lightCard: 'rgba(255, 255, 255, 0.75)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
