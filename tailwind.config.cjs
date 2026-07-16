/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        vermilion: 'rgb(var(--vermilion) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Noto Sans"', '"Helvetica Neue"', 'sans-serif'],
        display: ['Cambria', 'Georgia', '"Noto Serif"', '"Yu Mincho"', '"Hiragino Mincho ProN"', 'serif'],
        jp: ['"Yu Mincho"', '"Hiragino Mincho ProN"', '"Hiragino Mincho Pro"', '"Noto Serif JP"', '"Noto Serif CJK JP"', 'serif']
      },
      boxShadow: {
        card: '0 24px 60px rgb(var(--shadow) / 0.16), 0 2px 8px rgb(var(--shadow) / 0.08)'
      }
    }
  },
  plugins: []
};
