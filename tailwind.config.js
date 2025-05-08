/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1d4ed8',
          light: '#3b82f6',
        },
        secondary: {
          DEFAULT: '#64748b',
          dark: '#475569',
          light: '#94a3b8',
        },
        background: {
          DEFAULT: '#f8fafc',
          dark: '#f1f5f9',
        },
      },
      boxShadow: {
        'nav': '0 2px 4px rgba(0, 0, 0, 0.1)',
        'button': '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}