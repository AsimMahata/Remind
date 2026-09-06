import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Auto-detect default API URL based on platform and Expo Host URI
function getDefaultApiUrl(): string {
  // 1. Explicit env variable takes priority
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Auto-detect LAN IP from Metro Bundler host when running on physical device
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }

  // 3. Android Emulator maps host machine localhost to 10.0.2.2
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  // 4. Default fallback
  return 'http://localhost:5000';
}

export const API_CONFIG = {
  BASE_URL: getDefaultApiUrl(),
  SYNC_RETRY_INTERVAL_MS: 10000,
  MAX_RETRY_ATTEMPTS: 5,
};
