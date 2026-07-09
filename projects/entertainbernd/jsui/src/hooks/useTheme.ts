import { useEffect, useState } from 'react';
import { retrieveLaunchParams, themeParamsState, useSignal } from '@telegram-apps/sdk-react';

export function useTheme() {
  const themeParams = useSignal(themeParamsState);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (themeParams) {
      const bg = themeParams.bgColor || '#1e1e2e';
      setIsDark(bg !== '#ffffff');
    }
  }, [themeParams]);

  return { isDark, themeParams };
}