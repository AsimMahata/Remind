import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import {
  startSpeechRecognition,
  stopSpeechRecognition,
  cancelSpeechRecognition,
  requestSpeechPermission,
  isSpeechRecognitionSupported,
} from '../services/speechToText';

interface SpeechInputButtonProps {
  onSpeechResult: (recognizedText: string) => void;
  currentText?: string;
}

export const SpeechInputButton: React.FC<SpeechInputButtonProps> = ({
  onSpeechResult,
  currentText = '',
}) => {
  const isSupported = isSpeechRecognitionSupported();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Pulse animation for active recording
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isListening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const handleStartListening = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setTranscript('');
    setShowModal(true);

    const hasPermission = await requestSpeechPermission();
    if (!hasPermission) {
      return;
    }

    if (isSupported) {
      setIsListening(true);
      await startSpeechRecognition({
        onStart: () => {
          setIsListening(true);
        },
        onResult: (text, isFinal) => {
          setTranscript(text);
          if (isFinal) {
            onSpeechResult(text);
          }
        },
        onError: (err) => {
          setIsListening(false);
        },
        onEnd: () => {
          setIsListening(false);
        },
      });
    }
  };

  const handleStopAndApply = async (appliedText?: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    await stopSpeechRecognition();
    setIsListening(false);
    setShowModal(false);

    const finalText = appliedText || transcript;
    if (finalText && finalText.trim()) {
      onSpeechResult(finalText.trim());
    }
  };

  const handleCancel = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    await cancelSpeechRecognition();
    setIsListening(false);
    setShowModal(false);
    setTranscript('');
  };

  const sampleDictations = [
    'Submit my assignment tomorrow at 7 PM',
    'Buy groceries and fruits',
    'Call Mom at 5 PM',
    'Team meeting on Monday morning',
    'Workout at gym at 7 PM',
  ];

  return (
    <>
      <TouchableOpacity
        style={styles.micButton}
        onPress={handleStartListening}
        activeOpacity={0.7}
        accessibilityLabel="Dictate task with voice"
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={22}
            color={isListening ? '#f87171' : Colors.accentCyan}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Interactive Speech Recognition Modal */}
      {showModal && (
        <Modal
          visible={showModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {/* Pulsing Icon */}
              <View style={styles.iconWrapper}>
                <Animated.View
                  style={[
                    styles.pulseRing,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: isListening ? 0.35 : 0,
                    },
                  ]}
                />
                <View style={styles.micCircle}>
                  <Ionicons name="mic" size={32} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.modalTitle}>
                {isListening ? 'Listening...' : isSupported ? 'Voice Dictation' : 'Speech Input'}
              </Text>
              <Text style={styles.modalSub}>
                {isListening
                  ? 'Speak your task aloud. Processed 100% locally on your device.'
                  : isSupported
                  ? 'Speak your task or select a quick preset below.'
                  : 'Select a quick task preset below, or tap the microphone icon on your keyboard for offline voice typing.'}
              </Text>

              {/* Recognized Text Box */}
              <View style={styles.transcriptBox}>
                <Text
                  style={[
                    styles.transcriptText,
                    !transcript && styles.transcriptPlaceholder,
                  ]}
                >
                  {transcript || 'e.g. "Buy groceries and call plumber"'}
                </Text>
              </View>

              {/* Quick Demo Suggestions */}
              <Text style={styles.sampleHeader}>Or tap a sample to insert:</Text>
              <View style={styles.samplesContainer}>
                {sampleDictations.map((sample, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.sampleChip}
                    onPress={() => {
                      setTranscript(sample);
                      handleStopAndApply(sample);
                    }}
                  >
                    <Text style={styles.sampleChipText}>"{sample}"</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.applyBtn]}
                  onPress={() => handleStopAndApply()}
                >
                  <Ionicons name="checkmark" size={18} color="#042236" style={{ marginRight: 4 }} />
                  <Text style={styles.applyBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  micButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonDisabled: {
    opacity: 0.35,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0c1626',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentCyan,
  },
  micCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  transcriptBox: {
    width: '100%',
    minHeight: 64,
    backgroundColor: '#13233c',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#224268',
    justifyContent: 'center',
    marginBottom: 14,
  },
  transcriptText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
    lineHeight: 22,
  },
  transcriptPlaceholder: {
    color: Colors.placeholder,
    fontStyle: 'italic',
  },
  sampleHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    alignSelf: 'flex-start',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  samplesContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 20,
  },
  sampleChip: {
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.25)',
  },
  sampleChipText: {
    fontSize: 11,
    color: Colors.accentCyan,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    backgroundColor: '#1e293b',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: Colors.accentCyan,
  },
  applyBtnText: {
    color: '#042236',
    fontSize: 14,
    fontWeight: '700',
  },
});
