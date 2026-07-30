import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  setTenant: (tenantId: string) => void;
  setHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      hydrated: false,
      setAuth: (user, token, refreshToken) => set({ user, token, refreshToken }),
      logout: () => set({ user: null, token: null, refreshToken: null }),
      setTenant: (tenantId) => set((state) => ({ user: state.user ? { ...state.user, tenantId } : null })),
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
