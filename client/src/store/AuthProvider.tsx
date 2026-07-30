import { useEffect, useRef } from 'react';
import { useAuthStore } from './authStore';
import api from '../services/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const hydrate = async () => {
      const storedToken = useAuthStore.getState().token;
      if (!storedToken) {
        setHydrated(true);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        const user = response.data.data;
        const currentRefreshToken = useAuthStore.getState().refreshToken;
        setAuth(user, storedToken, currentRefreshToken || '');
      } catch (error) {
        logout();
      } finally {
        setHydrated(true);
      }
    };

    hydrate();
  }, [setAuth, logout, setHydrated]);

  return <>{children}</>;
}
