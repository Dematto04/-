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
        line: 'rgb(var(--line) / <alpha-value>)',
        pink: 'rgb(var(--pink) / <alpha-value>)',
        peach: 'rgb(var(--peach) / <alpha-value>)',
        cream: 'rgb(var(--cream) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['ui-rounded', '"SF Pro Rounded"', '"Avenir Next Rounded"', '"Nunito Sans"', '"Segoe UI Variable Text"', '"Segoe UI"', '"Noto Sans"', 'sans-serif'],
        display: ['ui-rounded', '"SF Pro Rounded"', '"Avenir Next Rounded"', '"Nunito Sans"', '"Segoe UI Variable Display"', '"Segoe UI"', 'sans-serif'],
        jp: ['"Yu Mincho"', '"Hiragino Mincho ProN"', '"Hiragino Mincho Pro"', '"Noto Serif JP"', '"Noto Serif CJK JP"', 'serif']
      },
      boxShadow: {
        card: '0 24px 64px rgb(var(--shadow) / 0.2), 0 3px 12px rgb(var(--shadow) / 0.1), inset 0 1px rgb(255 255 255 / 0.04)'
      }
    }
  },
  plugins: []
};
