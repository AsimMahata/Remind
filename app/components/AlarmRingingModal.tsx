import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Alarm } from '../types/alarm';
import { Colors } from '../constants/theme';
import { formatAlarmTimeString } from '../services/alarmEngine';

interface AlarmRingingModalProps {
  alarm: Alarm | null;
  onDismiss: (alarmId: string) => void;
  onSnooze: (alarmId: string) => void;
}

export const AlarmRingingModal: React.FC<AlarmRingingModalProps> = ({
  alarm,
  onDismiss,
  onSnooze,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (alarm) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [alarm, pulseAnim]);

  if (!alarm) return null;

  const formattedTime = formatAlarmTimeString(alarm.time);

  const handleDismiss = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    onDismiss(alarm.id);
  };

  const handleSnooze = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onSnooze(alarm.id);
  };

  return (
    <Modal visible={true} transparent={false} animationType="slide">
      <StatusBar barStyle="light-content" backgroundColor="#021422" />
      <View style={styles.container}>
        {/* Pulsing Alarm Icon */}
        <Animated.View
          style={[
            styles.iconCircle,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Ionicons name="alarm" size={72} color={Colors.accentCyan} />
        </Animated.View>

        {/* Big Time Display */}
        <Text style={styles.timeText}>{formattedTime}</Text>

        {/* Alarm Label */}
        <Text style={styles.labelText}>
          {alarm.label?.trim() ? alarm.label : 'Alarm'}
        </Text>

        {/* Action Controls */}
        <View style={styles.actionsRow}>
          {/* Snooze Button */}
          <TouchableOpacity
            onPress={handleSnooze}
            style={styles.snoozeBtn}
            activeOpacity={0.8}
          >
            <Ionicons
              name="time-outline"
              size={22}
              color={Colors.accentUpcoming}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.snoozeText}>Snooze (10m)</Text>
          </TouchableOpacity>

          {/* Dismiss Button */}
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.dismissBtn}
            activeOpacity={0.85}
          >
            <Ionicons
              name="close-circle-outline"
              size={24}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#021422',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(79, 195, 247, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    borderWidth: 2,
    borderColor: 'rgba(79, 195, 247, 0.4)',
  },
  timeText: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 8,
  },
  labelText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.accentCyan,
    textAlign: 'center',
    marginBottom: 16,
  },
  temporaryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 48,
  },
  temporaryBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'column',
    width: '100%',
    paddingHorizontal: 12,
    gap: 16,
    marginTop: 20,
  },
  snoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingVertical: 16,
  },
  snoozeText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.accentUpcoming,
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  dismissText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
