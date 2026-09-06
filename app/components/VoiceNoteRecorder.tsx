import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import {
  requestMicPermission,
  startRecording,
  stopRecording,
  playRecording,
  stopPlayback,
  deleteRecording,
  fileExists,
  isRecordingSupported,
} from '../services/voiceNotes';

interface VoiceNoteRecorderProps {
  /** Pre-existing recording URI (e.g., on Edit screen) */
  existingUri?: string | null;
  /** True if server indicates a voice note exists but local file is not present (multi-device) */
  hasVoiceNoteOnServer?: boolean;
  /** Called when the recorded URI changes. null means the recording was deleted. */
  onRecordingChange: (uri: string | null) => void;
}

type RecorderState =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'stopping'
  | 'ready'
  | 'playing'
  | 'loading_playback';

/**
 * Self-contained voice note recorder/player component.
 * Only requests microphone permission when the user taps Record.
 * Must not be rendered unless voiceNotesEnabled is true.
 * Degrades gracefully in Expo Go (shows informational note instead of crashing).
 */
export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  existingUri,
  hasVoiceNoteOnServer,
  onRecordingChange,
}) => {
  // Graceful degradation: expo-av native module not available (e.g., Expo Go)
  if (!isRecordingSupported()) {
    return (
      <View style={styles.unsupportedNote}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.unsupportedText}>
          Voice notes require a development build (not available in Expo Go)
        </Text>
      </View>
    );
  }

  const [state, setState] = useState<RecorderState>(existingUri ? 'ready' : 'idle');
  const [recordedUri, setRecordedUri] = useState<string | null>(existingUri || null);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [playbackMs, setPlaybackMs] = useState<number>(0);

  const recordingRef = useRef<any | null>(null);
  const soundRef = useRef<any | null>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Verify the existing file still exists on this device
  useEffect(() => {
    if (existingUri) {
      fileExists(existingUri).then((exists) => {
        if (!exists) {
          // File no longer exists locally; reset to idle
          setRecordedUri(null);
          setState('idle');
        }
      });
    }
  }, [existingUri]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationTimer.current) clearInterval(durationTimer.current);
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const formatDuration = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleRecord = async () => {
    setState('requesting_permission');
    const granted = await requestMicPermission();

    if (!granted) {
      setState(recordedUri ? 'ready' : 'idle');
      Alert.alert(
        'Microphone Access Required',
        'To record a voice note, allow microphone access in your device Settings.',
        [{ text: 'OK' }]
      );
      return;
    }

    setState('recording');
    setDurationMs(0);

    const recording = await startRecording();
    if (!recording) {
      setState(recordedUri ? 'ready' : 'idle');
      Alert.alert('Recording Failed', 'Could not start recording. Please try again.');
      return;
    }

    recordingRef.current = recording;

    // Live duration counter
    durationTimer.current = setInterval(() => {
      setDurationMs((prev) => prev + 250);
    }, 250);
  };

  const handleStop = async () => {
    if (!recordingRef.current) return;
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }

    setState('stopping');
    const uri = await stopRecording(recordingRef.current);
    recordingRef.current = null;

    if (uri) {
      setRecordedUri(uri);
      setState('ready');
      onRecordingChange(uri);
    } else {
      setState('idle');
      Alert.alert('Recording Failed', 'Could not save the recording. Please try again.');
    }
  };

  const handlePlay = async () => {
    if (!recordedUri) return;
    setState('loading_playback');
    setPlaybackMs(0);

    const sound = await playRecording(recordedUri);
    if (!sound) {
      setState('ready');
      Alert.alert('Playback Failed', 'Could not play the recording.');
      return;
    }

    soundRef.current = sound;
    setState('playing');

    // Track playback progress
    durationTimer.current = setInterval(async () => {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          setPlaybackMs(status.positionMillis || 0);
          if (status.didJustFinish) {
            handleStopPlayback();
          }
        }
      } catch {}
    }, 250);
  };

  const handleStopPlayback = async () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
    if (soundRef.current) {
      await stopPlayback(soundRef.current);
      soundRef.current = null;
    }
    setState('ready');
    setPlaybackMs(0);
  };

  const handleReRecord = () => {
    Alert.alert(
      'Re-record Voice Note',
      'This will replace the current recording. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-record',
          onPress: async () => {
            if (soundRef.current) {
              await stopPlayback(soundRef.current);
              soundRef.current = null;
            }
            // Delete the old file silently before recording a new one
            if (recordedUri) {
              await deleteRecording(recordedUri);
              setRecordedUri(null);
              onRecordingChange(null);
            }
            setState('idle');
            // Start a fresh recording immediately
            handleRecord();
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Voice Note',
      'Remove this voice note? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (soundRef.current) {
              await stopPlayback(soundRef.current);
              soundRef.current = null;
            }
            if (recordedUri) {
              await deleteRecording(recordedUri);
            }
            setRecordedUri(null);
            setDurationMs(0);
            setPlaybackMs(0);
            setState('idle');
            onRecordingChange(null);
          },
        },
      ]
    );
  };

  // Multi-device: server knows about a voice note but local file is gone
  if (!recordedUri && hasVoiceNoteOnServer && state === 'idle') {
    return (
      <View style={styles.multiDeviceNote}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.multiDeviceText}>
          Voice note recorded on another device
        </Text>
      </View>
    );
  }

  // IDLE — no recording yet
  if (state === 'idle') {
    return (
      <TouchableOpacity
        style={styles.recordButton}
        onPress={handleRecord}
        activeOpacity={0.7}
        accessibilityLabel="Record voice note"
      >
        <Ionicons name="mic-outline" size={22} color={Colors.accentCyan} />
        <Text style={styles.recordButtonText}>Record</Text>
      </TouchableOpacity>
    );
  }

  // REQUESTING PERMISSION
  if (state === 'requesting_permission') {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator size="small" color={Colors.accentCyan} />
        <Text style={styles.statusText}>Checking permission…</Text>
      </View>
    );
  }

  // RECORDING
  if (state === 'recording') {
    return (
      <View style={styles.recordingRow}>
        <View style={styles.recordingIndicator} />
        <Text style={styles.durationText}>{formatDuration(durationMs)}</Text>
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStop}
          activeOpacity={0.7}
          accessibilityLabel="Stop recording"
        >
          <Ionicons name="stop-circle-outline" size={22} color="#f87171" />
          <Text style={styles.stopButtonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // STOPPING
  if (state === 'stopping') {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator size="small" color={Colors.accentCyan} />
        <Text style={styles.statusText}>Saving…</Text>
      </View>
    );
  }

  // LOADING PLAYBACK
  if (state === 'loading_playback') {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator size="small" color={Colors.accentCyan} />
        <Text style={styles.statusText}>Loading…</Text>
      </View>
    );
  }

  // READY or PLAYING
  return (
    <View style={styles.playbackRow}>
      {state === 'playing' ? (
        <TouchableOpacity
          style={styles.playButton}
          onPress={handleStopPlayback}
          activeOpacity={0.7}
          accessibilityLabel="Stop playback"
        >
          <Ionicons name="stop-outline" size={20} color={Colors.accentCyan} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlay}
          activeOpacity={0.7}
          accessibilityLabel="Play voice note"
        >
          <Ionicons name="play-outline" size={20} color={Colors.accentCyan} />
        </TouchableOpacity>
      )}

      <Text style={styles.playDurationText}>
        {state === 'playing'
          ? formatDuration(playbackMs)
          : formatDuration(durationMs)}
      </Text>

      <View style={styles.playbackActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleReRecord}
          activeOpacity={0.7}
          accessibilityLabel="Re-record voice note"
        >
          <Ionicons name="refresh-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.actionButtonText}>Re-record</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
          activeOpacity={0.7}
          accessibilityLabel="Delete voice note"
        >
          <Ionicons name="trash-outline" size={18} color="#f87171" />
          <Text style={[styles.actionButtonText, styles.deleteText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.25)',
    alignSelf: 'flex-start',
    gap: 8,
  },
  recordButtonText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.accentCyan,
    fontWeight: Typography.weights.medium,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  statusText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
    gap: 10,
  },
  recordingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f87171',
  },
  durationText: {
    flex: 1,
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
    fontVariant: ['tabular-nums'],
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopButtonText: {
    fontSize: Typography.fontSizes.sm,
    color: '#f87171',
    fontWeight: Typography.weights.medium,
  },
  playbackRow: {
    backgroundColor: 'rgba(79, 195, 247, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.15)',
    gap: 10,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79, 195, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playDurationText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  playbackActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  actionButtonText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
  },
  deleteButton: {
    borderColor: 'rgba(248,113,113,0.25)',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  deleteText: {
    color: '#f87171',
  },
  multiDeviceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  multiDeviceText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  unsupportedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  unsupportedText: {
    flex: 1,
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});
