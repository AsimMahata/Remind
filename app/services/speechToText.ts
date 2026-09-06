/**
 * Speech-to-Text (STT) Service
 *
 * Dedicated speech recognition service that converts spoken audio into text.
 * Used exclusively for creating/editing tasks by speaking.
 *
 * Key rules:
 * - VOICE → TEXT → TASK (Does NOT speak anything back)
 * - Permission requested on-demand only when user taps microphone
 * - Works across Web Speech API and native environments
 */

import { NativeModules, Platform } from 'react-native';

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

/**
 * Checks if speech recognition engine is available in the current runtime.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    }
    return false;
  }

  // Check for native @react-native-voice/voice if linked
  if (NativeModules?.Voice || NativeModules?.RNVoice) {
    return true;
  }

  try {
    const VoiceModule = require('@react-native-voice/voice');
    if (VoiceModule && (VoiceModule.default || VoiceModule.start)) {
      return true;
    }
  } catch {
    // Native voice module not present in Expo Go
  }

  return false;
}

/**
 * Request speech recognition / microphone permission on-demand.
 * Must NOT be called at application startup.
 */
export async function requestSpeechPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (err) {
        console.warn('[SpeechToText] Web microphone permission denied:', err);
        return false;
      }
    }
    return true;
  }

  return true;
}

/**
 * Returns whether speech recognition is actively listening
 */
export function isListening(): boolean {
  return isCurrentlyListening;
}

/**
 * Starts listening to the microphone and streams back speech recognition results.
 */
export async function startSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks
): Promise<boolean> {
  if (isCurrentlyListening) {
    await stopSpeechRecognition();
  }

  // 1. Web Speech API (Chrome, Safari, Edge, Android Chrome, WebView)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass();
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
          console.warn('[SpeechToText] Recognition error:', event.error);
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
        console.warn('[SpeechToText] Failed to start Web SpeechRecognition:', err);
        callbacks.onError?.(err?.message || 'Failed to start speech recognition');
        return false;
      }
    }
  }

  // 2. Native React Native Voice if installed
  try {
    const VoiceModule = require('@react-native-voice/voice');
    const Voice = VoiceModule.default || VoiceModule;

    if (Voice && typeof Voice.start === 'function') {
      Voice.onSpeechStart = () => {
        isCurrentlyListening = true;
        callbacks.onStart?.();
      };
      Voice.onSpeechResults = (e: any) => {
        const text = e.value && e.value[0] ? e.value[0] : '';
        if (text) {
          callbacks.onResult?.(text, true);
        }
      };
      Voice.onSpeechPartialResults = (e: any) => {
        const text = e.value && e.value[0] ? e.value[0] : '';
        if (text) {
          callbacks.onResult?.(text, false);
        }
      };
      Voice.onSpeechError = (e: any) => {
        isCurrentlyListening = false;
        callbacks.onError?.(e.error?.message || 'Speech recognition error');
      };
      Voice.onSpeechEnd = () => {
        isCurrentlyListening = false;
        callbacks.onEnd?.();
      };

      activeRecognitionInstance = Voice;
      await Voice.start(callbacks.lang || 'en-US');
      return true;
    }
  } catch {
    // Native Voice module not present
  }

  return false;
}

/**
 * Stops an active speech recognition session.
 */
export async function stopSpeechRecognition(): Promise<void> {
  if (!isCurrentlyListening && !activeRecognitionInstance) return;

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
  }
}

/**
 * Cancels/Aborts an active speech recognition session.
 */
export async function cancelSpeechRecognition(): Promise<void> {
  if (!isCurrentlyListening && !activeRecognitionInstance) return;

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
  }
}
