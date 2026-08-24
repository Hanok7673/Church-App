import { useAuthStore, type AuthSession } from "@/stores/auth-store";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
let refreshPromise: Promise<AuthSession | null> | null = null;

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown; authenticated?: boolean };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = useAuthStore.getState().session;
  const { body, authenticated, ...requestOptions } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(authenticated && session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 401 && authenticated && session) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) return apiRequest<T>(path, options);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "REQUEST_FAILED", message: "The request could not be completed." })) as { error?: string; message?: string };
    throw new ApiError(response.status, payload.error ?? "REQUEST_FAILED", payload.message ?? "The request could not be completed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function refreshSession(refreshToken: string) {
  refreshPromise ??= (async () => {
    try {
      const session = await apiRequest<AuthSession>("/v1/auth/refresh", { method: "POST", body: { refreshToken } });
      await useAuthStore.getState().setSession(session);
      return session;
    } catch {
      await useAuthStore.getState().clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
