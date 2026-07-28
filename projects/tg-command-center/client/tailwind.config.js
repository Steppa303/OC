/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2AABEE',
        'primary-dark': '#229ED9',
        bg: {
          DEFAULT: 'var(--bg, #ffffff)',
          secondary: 'var(--bg-secondary, #f4f4f5)',
          tertiary: 'var(--bg-tertiary, #e4e4e7)',
        },
        text: {
          DEFAULT: 'var(--text, #1a1a1a)',
          muted: 'var(--text-muted, #71717a)',
        },
        border: 'var(--border, #e4e4e7)',
        card: {
          DEFAULT: 'var(--card, #ffffff)',
          border: 'var(--card-border, #e4e4e7)',
        },
        danger: '#ef4444',
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 30px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        'card-drag': '0 16px 48px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)',
        toolbar: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};
