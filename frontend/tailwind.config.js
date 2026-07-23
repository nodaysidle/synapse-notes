/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'base': '#0A0A0F',
        'base-dark': '#060609',
        'accent': {
          DEFAULT: '#C8FF00',
          light: '#d4ff1a',
          dark: '#a0cc00',
        },
        'accent-secondary': {
          DEFAULT: '#F0F0F5',
          light: '#ffffff',
          dark: '#d0d0d8',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'aurora': 'linear-gradient(135deg, rgba(200,255,0,0.08) 0%, rgba(200,255,0,0.04) 50%, rgba(107,107,128,0.03) 100%)',
      },
      backdropBlur: {
        'glass': '20px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(200, 255, 0, 0.16)',
        'glow-lg': '0 0 40px rgba(200, 255, 0, 0.22)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(200, 255, 0, 0.16)' },
          '50%': { boxShadow: '0 0 40px rgba(200, 255, 0, 0.34)' },
        },
      },
    },
  },
  plugins: [],
}
