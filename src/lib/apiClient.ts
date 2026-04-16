type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
};

import { getApiBaseUrl } from '@/lib/publicConfig';

const API_BASE = getApiBaseUrl();

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  if (!API_BASE) {
    throw new Error('Missing NEXT_PUBLIC_API_BASE_URL.');
  }

  const { method = 'GET', body, accessToken } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed.');
  }

  return response.json() as Promise<T>;
}

/**
 * Convenience wrapper that automatically attaches Supabase access_token
 * from zustand auth store (client-side only).
 */
export async function apiRequestWithAuth<T>(path: string, options: Omit<ApiRequestOptions, 'accessToken'> = {}) {
  // Import lazily to avoid circular deps in environments where store isn't available.
  const { useAuthStore } = await import('@/store/useAuthStore');
  const token = useAuthStore.getState().session?.access_token ?? null;
  return apiRequest<T>(path, { ...options, accessToken: token });
}