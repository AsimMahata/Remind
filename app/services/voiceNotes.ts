/**
 * Voice Notes Service
 *
 * Handles audio recording, playback, and local file management.
 * Files are stored in documentDirectory/voice_notes/ and never leave the device.
 *
 * Safe for Expo Go and dev builds: does not trigger ExponentAV native module errors.
 */

import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Safely detect if ExponentAV native module is linked before loading expo-av
const hasNativeAV =
  Platform.OS === 'web' ||
  !!(
    NativeModules?.ExponentAV ||
    (globalThis as any)?.expo?.modules?.ExponentAV
  );

let _av: typeof import('expo-av') | null = null;
if (hasNativeAV) {
  try {
    _av = require('expo-av');
  } catch {
    _av = null;
  }
}

const VOICE_NOTES_DIR = `${FileSystem.documentDirectory}voice_notes/`;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** True when expo-av is available (i.e. in a development or production build). */
export const isRecordingSupported = (): boolean => _av !== null;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VOICE_NOTES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VOICE_NOTES_DIR, { intermediates: true });
  }
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * Request microphone permission.
 * Call this only right before recording — never at app startup.
 */
export async function requestMicPermission(): Promise<boolean> {
  if (!_av) return false;
  try {
    const { status } = await _av.Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('[VoiceNotes] requestMicPermission:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/** Start recording. Returns the Recording object, or null on failure. */
export async function startRecording(): Promise<any | null> {
  if (!_av) return null;
  try {
    await _av.Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await _av.Audio.Recording.createAsync(
      _av.Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    return recording;
  } catch (err) {
    console.error('[VoiceNotes] startRecording:', err);
    return null;
  }
}

/**
 * Stop a recording and persist the file locally.
 * Returns the file URI, or null on failure.
 */
export async function stopRecording(recording: any): Promise<string | null> {
  if (!_av || !recording) return null;
  try {
    await recording.stopAndUnloadAsync();
    await _av.Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

    const tempUri: string | null = recording.getURI();
    if (!tempUri) return null;

    await ensureDir();
    const name = `vn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.m4a`;
    const dest = `${VOICE_NOTES_DIR}${name}`;
    await FileSystem.moveAsync({ from: tempUri, to: dest });
    return dest;
  } catch (err) {
    console.error('[VoiceNotes] stopRecording:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

/** Play a local voice note. Returns the Sound object, or null on failure. */
export async function playRecording(uri: string): Promise<any | null> {
  if (!_av) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      console.warn('[VoiceNotes] File not found:', uri);
      return null;
    }

    await _av.Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
    const { sound } = await _av.Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    return sound;
  } catch (err) {
    console.error('[VoiceNotes] playRecording:', err);
    return null;
  }
}

/** Stop and unload a playing Sound object. */
export async function stopPlayback(sound: any): Promise<void> {
  if (!sound) return;
  try {
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch (err) {
    console.warn('[VoiceNotes] stopPlayback:', err);
  }
}

// ---------------------------------------------------------------------------
// File management
// ---------------------------------------------------------------------------

/** Delete a local voice note file. Safe to call even if the file is gone. */
export async function deleteRecording(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (err) {
    console.warn('[VoiceNotes] deleteRecording:', err);
  }
}

/** Returns true if the local audio file still exists on this device. */
export async function fileExists(uri: string | null | undefined): Promise<boolean> {
  if (!uri) return false;
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

/**
 * Delete any audio files in the voice_notes folder that are not in activeUris.
 * Call after purging reminders from Trash.
 */
export async function cleanupOrphanedFiles(activeUris: string[]): Promise<void> {
  try {
    if (!(await FileSystem.getInfoAsync(VOICE_NOTES_DIR)).exists) return;
    const active = new Set(activeUris);
    for (const file of await FileSystem.readDirectoryAsync(VOICE_NOTES_DIR)) {
      const path = `${VOICE_NOTES_DIR}${file}`;
      if (!active.has(path)) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    }
  } catch (err) {
    console.warn('[VoiceNotes] cleanupOrphanedFiles:', err);
  }
}
