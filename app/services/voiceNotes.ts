/**
 * Voice Notes Service (Modern expo-audio Integration)
 *
 * Handles audio recording, playback, and local file management using expo-audio.
 * Files are stored in documentDirectory/voice_notes/ and never leave the device.
 *
 * Fully compatible with React Native New Architecture (TurboModules & JSI).
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

let _expoAudio: any = null;
try {
  _expoAudio = require('expo-audio');
} catch {
  _expoAudio = null;
}

const VOICE_NOTES_DIR = `${FileSystem.documentDirectory}voice_notes/`;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

function getAudioRecorderClass(): any | null {
  if (!_expoAudio) return null;
  const cls = _expoAudio.AudioModule?.AudioRecorder || _expoAudio.AudioRecorder;
  return typeof cls === 'function' ? cls : null;
}

function getPlatformRecordingOptions(options: any): any {
  if (!options) return {};
  const common = {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: options.isMeteringEnabled ?? false,
  };
  const platformExtra = Platform.OS === 'android' ? options.android : options.ios;
  return {
    ...common,
    ...platformExtra,
  };
}

/** True when expo-audio is available. */
export const isRecordingSupported = (): boolean => getAudioRecorderClass() !== null;

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
 * Request microphone recording permission.
 * Call this only right before recording — never at app startup.
 */
export async function requestMicPermission(): Promise<boolean> {
  if (!_expoAudio) return false;
  try {
    if (typeof _expoAudio.requestRecordingPermissionsAsync === 'function') {
      const { status } = await _expoAudio.requestRecordingPermissionsAsync();
      return status === 'granted';
    }
    return false;
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
  const RecorderClass = getAudioRecorderClass();
  if (!RecorderClass) {
    console.warn('[VoiceNotes] AudioRecorder native constructor is not available in current environment.');
    return null;
  }
  try {
    if (typeof _expoAudio.setAudioModeAsync === 'function') {
      await _expoAudio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    }

    const rawPreset = _expoAudio.RecordingPresets?.HIGH_QUALITY || {};
    const platformOptions = getPlatformRecordingOptions(rawPreset);
    const recorder = new RecorderClass(platformOptions);
    if (typeof recorder.prepareToRecordAsync === 'function') {
      await recorder.prepareToRecordAsync(rawPreset);
    }
    if (typeof recorder.record === 'function') {
      recorder.record();
    }
    return recorder;
  } catch (err) {
    console.error('[VoiceNotes] startRecording:', err);
    return null;
  }
}

/**
 * Stop a recording and persist the file locally.
 * Returns the file URI, or null on failure.
 */
export async function stopRecording(recorder: any): Promise<string | null> {
  if (!recorder) return null;
  try {
    if (typeof recorder.stop === 'function') {
      await recorder.stop();
    }
    if (_expoAudio && typeof _expoAudio.setAudioModeAsync === 'function') {
      await _expoAudio.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    }

    const tempUri: string | null = recorder.uri || (typeof recorder.getURI === 'function' ? recorder.getURI() : null);
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

/** Play a local voice note. Returns the Player object, or null on failure. */
export async function playRecording(uri: string): Promise<any | null> {
  if (!_expoAudio) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      console.warn('[VoiceNotes] File not found:', uri);
      return null;
    }

    if (typeof _expoAudio.setAudioModeAsync === 'function') {
      await _expoAudio.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldDuckAndroid: true,
      });
    }

    if (typeof _expoAudio.createAudioPlayer === 'function') {
      const player = _expoAudio.createAudioPlayer({ uri });
      if (typeof player.play === 'function') {
        player.play();
      }
      return player;
    }
    return null;
  } catch (err) {
    console.error('[VoiceNotes] playRecording:', err);
    return null;
  }
}

/** Stop and release a playing Player object. */
export async function stopPlayback(player: any): Promise<void> {
  if (!player) return;
  try {
    if (typeof player.pause === 'function') {
      player.pause();
    }
    if (typeof player.release === 'function') {
      player.release();
    } else if (typeof player.remove === 'function') {
      player.remove();
    }
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
