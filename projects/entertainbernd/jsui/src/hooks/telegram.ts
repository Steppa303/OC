/**
 * Safe Telegram SDK wrapper – fängt Fehler ab wenn Telegram nicht ready ist.
 * Nutzt direktes window.Telegram.WebApp statt @telegram-apps/sdk-react Hooks.
 */

const getTG = () => {
  if (typeof window === 'undefined') return null;
  return (window as any)?.Telegram?.WebApp ?? null;
};

export function safeHapticFeedback() {
  const tg = getTG();
  if (!tg?.HapticFeedback) return;
  return {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' = 'medium') => {
      try { tg.HapticFeedback.impactOccurred(style); } catch {}
    },
    notificationOccurred: (type: 'error' | 'success' | 'warning') => {
      try { tg.HapticFeedback.notificationOccurred(type); } catch {}
    },
  };
}

export function safeBackButton() {
  const tg = getTG();
  if (!tg?.BackButton) return null;
  return {
    show: () => { try { tg.BackButton.show(); } catch {} },
    hide: () => { try { tg.BackButton.hide(); } catch {} },
    onClick: (cb: () => void) => {
      try {
        tg.BackButton.onClick(cb);
        return () => { try { tg.BackButton.offClick(cb); } catch {} };
      } catch { return () => {}; }
    },
  };
}

export function safeMainButton() {
  const tg = getTG();
  if (!tg?.MainButton) return null;
  return {
    show: () => { try { tg.MainButton.show(); } catch {} },
    hide: () => { try { tg.MainButton.hide(); } catch {} },
    setText: (text: string) => { try { tg.MainButton.setText(text); } catch {} },
    onClick: (cb: () => void) => {
      try {
        tg.MainButton.onClick(cb);
        return () => { try { tg.MainButton.offClick(cb); } catch {} };
      } catch { return () => {}; }
    },
  };
}

export function getInitData(): string | null {
  const tg = getTG();
  return tg?.initData || null;
}

export function getThemeParams(): Record<string, string> {
  const tg = getTG();
  return tg?.themeParams || {};
}