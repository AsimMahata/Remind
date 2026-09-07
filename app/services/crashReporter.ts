import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiRequest } from './api';
import { getAuthState } from './auth';

// Cooldown map: prevents reporting the exact same error multiple times within 10 seconds
const recentReports = new Map<string, number>();
const REPORT_COOLDOWN_MS = 10000;

interface CrashContext {
  componentStack?: string | null;
  screen?: string;
  action?: string;
  [key: string]: unknown;
}

/**
 * Report a runtime exception or crash to the backend.
 * - Captures stack trace, component stack, device metadata, and platform details.
 * - The backend encrypts sensitive diagnostics with AES-256-GCM.
 * - Completely fire-and-forget: guaranteed to NEVER throw or crash the app.
 */
export async function reportCrash(
  error: unknown,
  extraContext?: CrashContext
): Promise<void> {
  try {
    let errorName = 'UnknownError';
    let errorMessage = 'An unexpected error occurred';
    let stackTrace = '';

    if (error instanceof Error) {
      errorName = error.name || 'Error';
      errorMessage = error.message || String(error);
      stackTrace = error.stack || '';
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    }

    const componentStack = extraContext?.componentStack || '';
    const dedupeKey = `${errorName}::${errorMessage}::${stackTrace.slice(0, 100)}`;
    const now = Date.now();

    // Check cooldown
    const lastSent = recentReports.get(dedupeKey);
    if (lastSent && now - lastSent < REPORT_COOLDOWN_MS) {
      return;
    }
    recentReports.set(dedupeKey, now);

    // Collect device & session diagnostics
    const authState = getAuthState();
    const contextData: Record<string, unknown> = {
      timestamp: now,
      deviceName: Constants.deviceName || 'unknown',
      appOwnership: Constants.appOwnership || 'standalone',
      executionEnvironment: (Constants as any).executionEnvironment || 'unknown',
      userId: authState?.user?.id || null,
      userEmail: authState?.user?.email || null,
      ...extraContext,
    };

    // Fire and forget: send to backend
    await apiRequest('/errors/report', {
      method: 'POST',
      body: JSON.stringify({
        errorName: String(errorName).slice(0, 150),
        errorMessage: String(errorMessage).slice(0, 1500),
        stackTrace: String(stackTrace).slice(0, 5000),
        componentStack: String(componentStack).slice(0, 3000),
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        appVersion: Constants.expoConfig?.version || '1.0.0',
        context: contextData,
      }),
      timeoutMs: 8000,
    });
  } catch (reporterErr) {
    // Zero-Panic: never let the crash reporter itself throw or interrupt the user
    console.warn('[CrashReporter] Failed to send crash report to backend:', reporterErr);
  }
}
