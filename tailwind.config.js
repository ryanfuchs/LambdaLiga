/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#181A2F',
        'secondary-dark': '#242E49',
        'accent-dark': '#37415C',
        'accent-light': '#FDA481',
        'accent-red': '#B4182D',
        'dark-red': '#54162B',
      },
    },
  },
  plugins: [],
} 