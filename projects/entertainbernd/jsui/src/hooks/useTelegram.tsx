import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserInfo, AuthResponse } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  token: string | null;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function initAuth() {
      try {
        // Use raw Telegram WebApp object directly (always available in Mini App)
        const tg = (window as any).Telegram?.WebApp;

        if (!tg?.initData) {
          console.log('[auth] no Telegram initData found');
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error('[auth] backend rejected:', res.status, errText);
          setIsLoading(false);
          return;
        }

        const data: AuthResponse = await res.json();
        setToken(data.token);
        setUser(data.user);
      } catch (err) {
        console.error('[auth] error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, isLoading, user, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useApiHeaders() {
  const { token } = useAuth();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}