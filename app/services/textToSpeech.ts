/**
 * Text-to-Speech (TTS) Service
 *
 * Provides device-local speech synthesis for spoken reminders.
 * Format: "Reminder. <Task text>"
 *
 * Never sends reminder text to any external or cloud API.
 */

import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';

export interface TTSOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Resets audio mode back to playback (non-recording) if expo-audio was active
 */
async function ensureAudioModeForPlayback(): Promise<void> {
  try {
    const expoAudio = require('expo-audio');
    if (expoAudio && typeof expoAudio.setAudioModeAsync === 'function') {
      await expoAudio.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    }
  } catch {
    // expo-audio not available or not linked
  }
}

/**
 * Speaks a reminder aloud using device Text-to-Speech (TTS).
 * Format: "Reminder. <Task text>"
 */
export async function speakReminderText(taskText: string, options?: TTSOptions): Promise<void> {
  if (!taskText || !taskText.trim()) return;

  try {
    // 1. Ensure audio session allows loud playback and is not locked in recording mode
    await ensureAudioModeForPlayback();

    // 2. Stop any existing utterance and briefly allow queue to clear
    try {
      if (await Speech.isSpeakingAsync()) {
        await Speech.stop();
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    } catch {
      // ignore
    }

    const cleanText = taskText.trim();
    const messageToSpeak = cleanText.toLowerCase().startsWith('reminder')
      ? cleanText
      : `Reminder. ${cleanText}`;

    // 3. Queue speech utterance
    Speech.speak(messageToSpeak, {
      language: options?.language || undefined, // undefined uses device native default TTS voice
      pitch: options?.pitch ?? 1.0,
      rate: options?.rate ?? (Platform.OS === 'android' ? 0.95 : 1.0),
      volume: 1.0,
      ...(Platform.OS === 'ios' ? { useApplicationAudioSession: false } : {}),
      onStart: () => {
        options?.onStart?.();
      },
      onDone: () => {
        options?.onDone?.();
      },
      onError: (err) => {
        console.warn('[TextToSpeech] speech error:', err);
        options?.onError?.(new Error(String(err)));
      },
    });
  } catch (error) {
    console.error('TTS speakReminderText exception:', error);
    options?.onError?.(new Error(String(error)));
  }
}

/**
 * Stops any active speech output
 */
export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch (error) {
    console.error('Failed to stop speech:', error);
  }
}

/**
 * Test voice playback
 */
export async function testVoicePlayback(): Promise<void> {
  try {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    await speakReminderText('This is a voice reminder test for your Remind app.', {
      onError: (err) => {
        console.warn('testVoicePlayback error:', err);
      },
    });
  } catch (e) {
    console.warn('testVoicePlayback exception:', e);
  }
}
