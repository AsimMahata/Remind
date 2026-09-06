import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthState, AuthResponse } from '../types/auth';
import { apiRequest, setStoredToken, getStoredToken } from './api';

const USER_CACHE_KEY = '@remind_user_cache_v1';

let currentAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: true,
};

type AuthListener = (state: AuthState) => void;
const listeners: Set<AuthListener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...currentAuthState });
    } catch (e) {
      console.error('Error in auth listener:', e);
    }
  });
}

export function subscribeToAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener({ ...currentAuthState });
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthState(): AuthState {
  return { ...currentAuthState };
}

/**
 * Initialize auth on app boot
 */
export async function initializeAuth(): Promise<AuthState> {
  try {
    const token = await getStoredToken();
    const cachedUserRaw = await AsyncStorage.getItem(USER_CACHE_KEY);
    const cachedUser: User | null = cachedUserRaw ? JSON.parse(cachedUserRaw) : null;

    if (token) {
      currentAuthState = {
        isAuthenticated: true,
        user: cachedUser,
        token,
        isLoading: false,
      };
      notifyListeners();

      // Verify token in background if online
      apiRequest<{ user: User }>('/auth/me')
        .then(async ({ user }) => {
          currentAuthState.user = user;
          await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
          notifyListeners();
        })
        .catch((err) => {
          if (err.status === 401) {
            // Token expired
            logout();
          }
        });
    } else {
      currentAuthState = {
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
      };
      notifyListeners();
    }
  } catch (error) {
    console.error('Failed to initialize auth:', error);
    currentAuthState.isLoading = false;
    notifyListeners();
  }

  return { ...currentAuthState };
}

/**
 * Register a new user
 */
export async function registerUser(email: string, password: string): Promise<User> {
  const data = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  await setStoredToken(data.token);
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));

  currentAuthState = {
    isAuthenticated: true,
    user: data.user,
    token: data.token,
    isLoading: false,
  };
  notifyListeners();
  return data.user;
}

/**
 * Login user
 */
export async function loginUser(email: string, password: string): Promise<User> {
  const data = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  await setStoredToken(data.token);
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));

  currentAuthState = {
    isAuthenticated: true,
    user: data.user,
    token: data.token,
    isLoading: false,
  };
  notifyListeners();
  return data.user;
}

/**
 * Logout
 * Stops sync, clears session, leaves local SQLite reminders on device
 */
export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
  } finally {
    await setStoredToken(null);
    await AsyncStorage.removeItem(USER_CACHE_KEY);

    currentAuthState = {
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
    };
    notifyListeners();
  }
}
