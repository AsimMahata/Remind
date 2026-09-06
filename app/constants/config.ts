import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Cloud backend URL (Render live deployment)
export const DEFAULT_CLOUD_API_URL = 'https://remind-nc2b.onrender.com';

// Fallback cloud URL (checks build environment if set, otherwise defaults to cloud URL)
export const FALLBACK_CLOUD_URL =
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_CLOUD_API_URL;

// Backwards compatibility aliases
export const PRODUCTION_DEFAULT_API_URL = DEFAULT_CLOUD_API_URL;
export const ENV_FALLBACK_URL = FALLBACK_CLOUD_URL;

/**
 * Detect local development backend URL based on device/environment
 */
export function getLocalDevApiUrl(): string {
  // Physical device connected via Metro Bundler over Wi-Fi
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }

  // Android Emulator loopback mapping
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  // iOS Simulator / Web / default
  return 'http://localhost:5000';
}

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

// In APK release builds (__DEV__ === false), directly use the cloud backend.
// In dev mode (__DEV__ === true), start with localhost and fallback to cloud if unreachable.
let activeBaseUrl: string = isDev ? getLocalDevApiUrl() : FALLBACK_CLOUD_URL;

export function getActiveBaseUrl(): string {
  return activeBaseUrl;
}

/**
 * Switches the active API base URL to the cloud server
 */
export function fallbackToCloudBackend(): string {
  if (activeBaseUrl !== FALLBACK_CLOUD_URL) {
    console.log(`[API Config] Local backend unreachable. Falling back to cloud URL: ${FALLBACK_CLOUD_URL}`);
    activeBaseUrl = FALLBACK_CLOUD_URL;
  }
  return activeBaseUrl;
}

// Backwards compatibility alias
export const fallbackToEnvBackend = fallbackToCloudBackend;

/**
 * Switches the active API base URL back to the local development backend
 */
export function switchToLocalBackend(): string {
  const localUrl = getLocalDevApiUrl();
  activeBaseUrl = localUrl;
  console.log(`[API Config] Switched to local dev backend: ${localUrl}`);
  return activeBaseUrl;
}

/**
 * Probes the local backend health endpoint.
 * If reachable, stays on local backend; if unreachable, falls back to cloud URL.
 */
export async function probeBackend(timeoutMs = 1500): Promise<string> {
  if (!isDev) {
    activeBaseUrl = FALLBACK_CLOUD_URL;
    return activeBaseUrl;
  }

  const localUrl = getLocalDevApiUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${localUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      activeBaseUrl = localUrl;
      console.log(`[API Config] Local backend is active at ${localUrl}`);
      return activeBaseUrl;
    }
  } catch {
    // Local backend is not reachable
  }

  fallbackToCloudBackend();
  return activeBaseUrl;
}

// Automatically probe on startup in dev mode
if (isDev) {
  probeBackend(1500).catch(() => {});
}

export const API_CONFIG = {
  get BASE_URL(): string {
    return activeBaseUrl;
  },
  SYNC_RETRY_INTERVAL_MS: 10000,
  MAX_RETRY_ATTEMPTS: 5,
};


