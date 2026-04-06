import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAuthToken, clearAuth, disconnectSocket } from '../api/client';

interface AuthState {
  token: string | null;
  user: { id: string; username: string; role: string } | null;
  agentToken: string | null;
  agentId: string | null;
  login: (token: string, user: any) => void;
  loginAgent: (agentToken: string, agentId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      agentToken: null,
      agentId: null,
      login: (token, user) => {
        setAuthToken(token);
        set({ token, user });
      },
      loginAgent: (agentToken, agentId) => set({ agentToken, agentId }),
      logout: () => {
        clearAuth();
        disconnectSocket();
        set({ token: null, user: null, agentToken: null, agentId: null });
      },
    }),
    {
      name: 'agenthub-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token);
      },
    }
  )
);
