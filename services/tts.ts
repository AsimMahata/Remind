import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export interface TTSOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Speaks a reminder aloud using Android system Text-to-Speech (TTS).
 * Format: "Reminder. <Task text>"
 */
export async function speakReminderText(taskText: string, options?: TTSOptions): Promise<void> {
  if (!taskText || !taskText.trim()) return;

  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }

    const messageToSpeak = `Reminder. ${taskText.trim()}`;

    Speech.speak(messageToSpeak, {
      language: options?.language || 'en-US',
      pitch: options?.pitch ?? 1.0,
      rate: options?.rate ?? (Platform.OS === 'android' ? 0.95 : 1.0),
      onDone: options?.onDone,
      onError: (err) => {
        console.warn('Speech TTS error:', err);
        options?.onError?.(new Error(String(err)));
      },
    });
  } catch (error) {
    console.error('TTS speakReminderText exception:', error);
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
  await speakReminderText('This is a voice reminder test for your Remind app.');
}
