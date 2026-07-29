import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f9', 100: '#eceef2', 200: '#d5dae3', 300: '#b0bacb',
          400: '#8494ae', 500: '#637694', 600: '#4e5f7a', 700: '#404d63',
          800: '#374253', 900: '#313947', 950: '#20252e',
        },
        zest: {
          50: '#eef7ff', 100: '#d9edff', 200: '#bce0ff', 300: '#8ecdff',
          400: '#59b0ff', 500: '#328ffb', 600: '#1b70f0', 700: '#145add',
          800: '#174ab3', 900: '#19418d', 950: '#142a56',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
