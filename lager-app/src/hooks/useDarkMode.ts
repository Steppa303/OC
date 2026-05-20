import { useEffect } from 'react';
import { useAppStore } from '../store/itemStore';

export function useDarkMode() {
  const { theme, toggleTheme } = useAppStore();

  useEffect(() => {
    // Check system preference on first load
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    
    if (savedTheme) {
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  return {
    isDark: theme === 'dark',
    toggle: toggleTheme,
  };
}
