// Central API Client Module

export const API_URL = window.location.port === '5173'
  ? 'http://localhost:3000/api'
  : `${window.location.protocol}//${window.location.host}/api`;

export const WS_URL = window.location.port === '5173'
  ? 'ws://localhost:3000/ws'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/**
 * Normalizes relative or partial API paths into a full URL using API_URL.
 */
export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/api/')) {
    return `${API_URL}${path.substring(4)}`;
  }
  if (path.startsWith('/')) {
    return `${API_URL}${path}`;
  }
  return `${API_URL}/${path}`;
}

/**
 * Central API fetch client wrapper.
 * - Injects Authorization: Bearer <token> automatically from localStorage.
 * - Handles 401 Unauthorized by clearing jwt_token.
 * - Safely handles non-JSON or 404 responses so res.json() never throws uncaught SyntaxErrors.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<ApiResponse<T>> {
  const url = getApiUrl(endpoint);
  const headers = new Headers(options.headers || {});

  const token = localStorage.getItem('jwt_token');
  if (token && !headers.has('Authorization') && !options.skipAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      localStorage.removeItem('jwt_token');
    }

    const contentType = res.headers.get('content-type') || '';
    let data: T | null = null;

    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = null;
      }
    } else {
      await res.text().catch(() => '');
      data = null;
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || 'Network request failed',
    };
  }
}
