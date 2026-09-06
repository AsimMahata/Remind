import { API_CONFIG, fallbackToEnvBackend, ENV_FALLBACK_URL } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = '@remind_auth_token_v1';

export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to store auth token:', error);
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Universal API fetch client with timeout, automatic token attachment,
 * and dev-mode fallback from localhost to .env backend.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const token = await getStoredToken();
  const currentBaseUrl = API_CONFIG.BASE_URL;
  const url = `${currentBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const timeoutMs = options.timeoutMs || 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.error || `HTTP ${response.status}: ${response.statusText}`;
      const error = new Error(errorMsg);
      (error as any).status = response.status;
      throw error;
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    // In dev mode: if connection to local backend fails, automatically fallback to cloud backend and retry
    if (typeof __DEV__ !== 'undefined' && __DEV__ && currentBaseUrl !== ENV_FALLBACK_URL) {
      const isConnectionError =
        err.name === 'AbortError' ||
        err.message?.includes('Network request failed') ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('aborted');

      if (isConnectionError) {
        fallbackToEnvBackend();
        console.warn(`[API] Connection to local backend (${currentBaseUrl}) failed. Falling back to cloud backend (${ENV_FALLBACK_URL})...`);
        return apiRequest<T>(endpoint, options);
      }
    }

    if (err.name === 'AbortError' || err.message?.includes('canceled') || err.message?.includes('aborted')) {
      const error = new Error('Server connection timed out. Changes are saved locally.');
      (error as any).isTimeout = true;
      (error as any).isOffline = true;
      throw error;
    }
    if (err.message?.includes('Network request failed') || err.message?.includes('Failed to fetch')) {
      const error = new Error('Unable to reach cloud server. Working in offline mode.');
      (error as any).isOffline = true;
      throw error;
    }
    throw err;
  }
}
