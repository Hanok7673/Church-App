import { create } from "zustand";
import { deleteSessionValue, getSessionValue, setSessionValue } from "@/lib/session-storage";

const SESSION_KEY = "church-app-session-v1";

export type AuthUser = { id: string; email: string; fullName: string };
export type AuthSession = { accessToken: string; refreshToken: string; user: AuthUser };

type AuthState = {
  session: AuthSession | null;
  hydrated: boolean;
  hydrate(): Promise<void>;
  setSession(session: AuthSession): Promise<void>;
  clearSession(): Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,
  async hydrate() {
    const raw = await getSessionValue(SESSION_KEY);
    if (!raw) return set({ session: null, hydrated: true });
    try {
      set({ session: JSON.parse(raw) as AuthSession, hydrated: true });
    } catch {
      await deleteSessionValue(SESSION_KEY);
      set({ session: null, hydrated: true });
    }
  },
  async setSession(session) {
    await setSessionValue(SESSION_KEY, JSON.stringify(session));
    set({ session, hydrated: true });
  },
  async clearSession() {
    await deleteSessionValue(SESSION_KEY);
    set({ session: null, hydrated: true });
  },
}));
