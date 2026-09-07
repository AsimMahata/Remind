/**
 * Speech-to-Text (STT) Service - 100% On-Device & Local
 *
 * Dedicated speech recognition service that converts spoken audio into text.
 * Used exclusively for creating/editing tasks by speaking.
 *
 * PRIVACY GUARANTEE:
 * - 100% LOCAL: No audio, voice data, or speech transcripts are EVER sent to any server.
 * - No network requests: All recognition runs directly on-device.
 * - VOICE → TEXT → TASK (Does NOT speak anything back)
 * - Permission requested on-demand only when user taps microphone.
 */

import { Platform } from 'react-native';
import { requestMicPermission } from './voiceNotes';
import { reportCrash } from './crashReporter';

// Safely resolve ExpoSpeechRecognitionModule and ExpoWebSpeechRecognition
let ExpoSpeechRecognitionModule: any = null;
let ExpoWebSpeechRecognition: any = null;

try {
  const speechPkg = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechPkg?.ExpoSpeechRecognitionModule || null;
  ExpoWebSpeechRecognition = speechPkg?.ExpoWebSpeechRecognition || null;
} catch {
  // Graceful fallback if native module or package isn't present
}

export interface SpeechRecognitionCallbacks {
  onStart?: () => void;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  lang?: string;
}

// Active session holder
let activeRecognitionInstance: any = null;
let isCurrentlyListening = false;
let activeCallbacks: SpeechRecognitionCallbacks | null = null;

/**
 * Checks if local on-device speech recognition engine is available.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || ExpoWebSpeechRecognition);
    }
    return false;
  }

  try {
    if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.getPermissionsAsync === 'function') {
      return true;
    }
    if (ExpoWebSpeechRecognition) {
      return true;
    }
  } catch {
    // Native module not linked in current runtime (e.g. standard Expo Go)
  }

  return false;
}

/**
 * Request speech recognition / microphone permission on-demand.
 * Must NOT be called at application startup.
 */
export async function requestSpeechPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }
      return true;
    }

    if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === 'function') {
      const resp = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return !!resp.granted;
    }
  } catch (err) {
    console.warn('[SpeechToText] Permission request failed:', err);
  }

  return await requestMicPermission();
}

/**
 * Returns whether speech recognition is actively listening
 */
export function isListening(): boolean {
  return isCurrentlyListening;
}

/**
 * Starts listening to the microphone locally on-device.
 */
export async function startSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks
): Promise<boolean> {
  if (isCurrentlyListening) {
    await stopSpeechRecognition();
  }

  activeCallbacks = callbacks;

  // Diagnostic metadata collected for backend error telemetry
  let availableServices: string[] = [];
  let defaultServicePkg: string | null = null;
  let isRecognitionAvailable = false;
  let targetPackage: string | undefined = undefined;

  // Inspect Android speech capabilities
  if (Platform.OS === 'android' && ExpoSpeechRecognitionModule) {
    try {
      if (typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function') {
        isRecognitionAvailable = !!ExpoSpeechRecognitionModule.isRecognitionAvailable();
      }
      if (typeof ExpoSpeechRecognitionModule.getSpeechRecognitionServices === 'function') {
        availableServices = ExpoSpeechRecognitionModule.getSpeechRecognitionServices() || [];
      }
      if (typeof ExpoSpeechRecognitionModule.getDefaultRecognitionService === 'function') {
        defaultServicePkg = ExpoSpeechRecognitionModule.getDefaultRecognitionService()?.packageName || null;
      }

      // Priority ordering for target speech package on Android
      if (defaultServicePkg && (availableServices.length === 0 || availableServices.includes(defaultServicePkg))) {
        targetPackage = defaultServicePkg;
      } else if (availableServices.includes('com.google.android.googlequicksearchbox')) {
        targetPackage = 'com.google.android.googlequicksearchbox';
      } else if (availableServices.includes('com.google.android.tts')) {
        targetPackage = 'com.google.android.tts';
      } else if (availableServices.includes('com.google.android.as')) {
        targetPackage = 'com.google.android.as';
      } else if (availableServices.length > 0) {
        targetPackage = availableServices[0];
      }
    } catch (e) {
      console.warn('[SpeechToText] Capability check warning:', e);
    }
  }

  // 1. Native ExpoSpeechRecognitionModule (Preferred for mobile devices: Android & iOS)
  if (Platform.OS !== 'web' && ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.start === 'function') {
    try {
      const subStart = ExpoSpeechRecognitionModule.addListener('start', () => {
        isCurrentlyListening = true;
        callbacks.onStart?.();
      });

      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const results = event?.results || [];
        const topResult = results[0]?.transcript || '';
        if (topResult) {
          callbacks.onResult?.(topResult, !!event?.isFinal);
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        isCurrentlyListening = false;
        const errCode = event?.error || event?.message || 'Speech recognition error';
        console.warn('[SpeechToText] Native recognition error:', event);

        // Send full error & device diagnostic telemetry to the backend
        reportCrash(new Error(`SpeechRecognitionError: ${errCode}`), {
          feature: 'speech-to-text',
          action: 'ExpoSpeechRecognitionModule.start',
          errorType: errCode,
          rawEvent: event,
          targetPackage,
          defaultServicePkg,
          availableServices,
          isRecognitionAvailable,
        });

        callbacks.onError?.(errCode);
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        isCurrentlyListening = false;
        subStart?.remove?.();
        subResult?.remove?.();
        subError?.remove?.();
        subEnd?.remove?.();
        callbacks.onEnd?.();
      });

      const startOptions: any = {
        lang: callbacks.lang || 'en-US',
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
      };

      if (targetPackage) {
        startOptions.androidRecognitionServicePackage = targetPackage;
      }

      ExpoSpeechRecognitionModule.start(startOptions);

      activeRecognitionInstance = {
        stop: () => ExpoSpeechRecognitionModule.stop(),
        abort: () => ExpoSpeechRecognitionModule.abort(),
      };
      return true;
    } catch (err: any) {
      console.warn('[SpeechToText] ExpoSpeechRecognitionModule failed:', err);
      reportCrash(err, {
        feature: 'speech-to-text',
        action: 'ExpoSpeechRecognitionModule.start',
        targetPackage,
        defaultServicePkg,
        availableServices,
        isRecognitionAvailable,
      });
    }
  }

  // 2. ExpoWebSpeechRecognition (Cross-platform Web Speech API wrapper fallback)
  try {
    if (ExpoWebSpeechRecognition) {
      const recognition = new ExpoWebSpeechRecognition();
      recognition.lang = callbacks.lang || 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;
      try {
        recognition.addsPunctuation = true;
      } catch {}

      recognition.onstart = () => {
        isCurrentlyListening = true;
        callbacks.onStart?.();
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        if (event && event.results) {
          for (let i = event.resultIndex || 0; i < event.results.length; ++i) {
            const item = event.results[i];
            const transcript = item?.[0]?.transcript || item?.transcript || '';
            if (item?.isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
        }

        const resultText = (finalTranscript || interimTranscript).trim();
        if (resultText) {
          callbacks.onResult?.(resultText, !!finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        isCurrentlyListening = false;
        const errCode = event?.error || 'Speech recognition error';
        console.warn('[SpeechToText] Recognition error:', errCode);

        // Send error report to backend
        reportCrash(new Error(`SpeechRecognitionError: ${errCode}`), {
          feature: 'speech-to-text',
          action: 'ExpoWebSpeechRecognition',
          errorType: errCode,
          rawEvent: event,
          targetPackage,
          defaultServicePkg,
          availableServices,
          isRecognitionAvailable,
        });

        callbacks.onError?.(errCode);
      };

      recognition.onend = () => {
        isCurrentlyListening = false;
        activeRecognitionInstance = null;
        callbacks.onEnd?.();
      };

      activeRecognitionInstance = recognition;
      recognition.start();
      return true;
    }
  } catch (err: any) {
    console.warn('[SpeechToText] ExpoWebSpeechRecognition failed to start:', err);
    reportCrash(err, {
      feature: 'speech-to-text',
      action: 'ExpoWebSpeechRecognition.start',
    });
  }

  // 3. Fallback to browser SpeechRecognition if on web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const BrowserSpeechClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (BrowserSpeechClass) {
      try {
        const recognition = new BrowserSpeechClass();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = callbacks.lang || 'en-US';

        recognition.onstart = () => {
          isCurrentlyListening = true;
          callbacks.onStart?.();
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          const resultText = (finalTranscript || interimTranscript).trim();
          if (resultText) {
            callbacks.onResult?.(resultText, !!finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          isCurrentlyListening = false;
          console.warn('[SpeechToText] Web recognition error:', event.error);
          reportCrash(new Error(`SpeechRecognitionError: ${event.error}`), {
            feature: 'speech-to-text',
            action: 'BrowserSpeechClass',
            errorType: event.error,
          });
          callbacks.onError?.(event.error || 'Speech recognition error');
        };

        recognition.onend = () => {
          isCurrentlyListening = false;
          activeRecognitionInstance = null;
          callbacks.onEnd?.();
        };

        activeRecognitionInstance = recognition;
        recognition.start();
        return true;
      } catch (err: any) {
        console.warn('[SpeechToText] Browser recognition failed:', err);
        reportCrash(err, {
          feature: 'speech-to-text',
          action: 'BrowserSpeechClass.start',
        });
      }
    }
  }

  // Engine could not be initialized
  reportCrash(new Error('LOCAL_ENGINE_NOT_LINKED'), {
    feature: 'speech-to-text',
    action: 'startSpeechRecognition',
    targetPackage,
    defaultServicePkg,
    availableServices,
    isRecognitionAvailable,
  });
  callbacks.onError?.('LOCAL_ENGINE_NOT_LINKED');
  return false;
}

/**
 * Stops an active speech recognition session on-device.
 */
export async function stopSpeechRecognition(): Promise<void> {
  if (!isCurrentlyListening && !activeRecognitionInstance) {
    return;
  }

  try {
    if (activeRecognitionInstance) {
      if (typeof activeRecognitionInstance.stop === 'function') {
        activeRecognitionInstance.stop();
      }
    }
  } catch (err) {
    console.warn('[SpeechToText] stopSpeechRecognition error:', err);
  } finally {
    isCurrentlyListening = false;
    activeRecognitionInstance = null;
    activeCallbacks?.onEnd?.();
  }
}

/**
 * Cancels/Aborts an active speech recognition session without applying text.
 */
export async function cancelSpeechRecognition(): Promise<void> {
  if (!isCurrentlyListening && !activeRecognitionInstance) {
    return;
  }

  try {
    if (activeRecognitionInstance) {
      if (typeof activeRecognitionInstance.abort === 'function') {
        activeRecognitionInstance.abort();
      } else if (typeof activeRecognitionInstance.cancel === 'function') {
        activeRecognitionInstance.cancel();
      }
    }
  } catch (err) {
    console.warn('[SpeechToText] cancelSpeechRecognition error:', err);
  } finally {
    isCurrentlyListening = false;
    activeRecognitionInstance = null;
    activeCallbacks = null;
  }
}
