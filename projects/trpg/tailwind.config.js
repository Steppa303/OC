/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-dark': '#0a0a0f',
        'card-bg': '#1a1a2e',
        primary: '#6366f1',
        success: '#22c55e',
        danger: '#ef4444',
        gold: '#f59e0b',
        text: '#e2e8f0',
      },
    },
  },
  plugins: [],
};
