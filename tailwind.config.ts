import type { Config } from 'tailwindcss';

/**
 * Paleta: hartie calda + cerneala + un accent citric (de la "zest").
 * Majoritatea aplicatiilor scolare sunt albastre si reci; caldura
 * diferentiaza si se potriveste unui produs despre scris de mana.
 */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // neutre calde (stone), nu gri albastrui
        ink: {
          50: '#FAFAF9', 100: '#F5F5F4', 200: '#E7E5E4', 300: '#D6D3D1',
          400: '#A8A29E', 500: '#78716C', 600: '#57534E', 700: '#44403C',
          800: '#292524', 900: '#1C1917', 950: '#0F0E0D',
        },
        // accent citric
        zest: {
          50: '#FFF8ED', 100: '#FFEFD4', 200: '#FEDBA8', 300: '#FDC171',
          400: '#FB9D38', 500: '#F98012', 600: '#EA6508', 700: '#C24C09',
          800: '#9A3D10', 900: '#7C3410', 950: '#431806',
        },
        paper: '#FCFBF9',
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,0.04), 0 1px 3px rgba(28,25,23,0.06)',
        lift: '0 2px 4px rgba(28,25,23,0.04), 0 12px 28px -12px rgba(28,25,23,0.18)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'none' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
      animation: {
        'fade-up': 'fade-up .18s ease-out',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
