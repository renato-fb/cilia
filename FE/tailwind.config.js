/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0b3142',
        secondary: '#f97316',
        text: '#1e293b',
        success: '#10b981',
        error: '#f43f5e',
        'input-bg': 'rgba(248, 250, 252, 0.3)',
        'input-border': '#e2e8f0',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
