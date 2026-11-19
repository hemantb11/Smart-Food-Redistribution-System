/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          400: '#38bdf8',
          500: '#0ea5e9', // Sky Blue Primary
          600: '#0284c7',
        },
        slateDark: {
          900: '#0f172a', // Dark Slate Background
          950: '#020617', // Very Dark Slate
        }
      }
    },
  },
  plugins: [],
}