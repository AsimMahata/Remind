import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Alarm } from '../types/alarm';
import { Colors } from '../constants/theme';
import { formatAlarmTimeString, getRemainingTimeText } from '../services/alarmEngine';

interface AlarmCardProps {
  alarm: Alarm;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onEditPress: (alarm: Alarm) => void;
  onDeletePress: (id: string) => void;
}

export const AlarmCard: React.FC<AlarmCardProps> = ({
  alarm,
  onToggleEnabled,
  onEditPress,
  onDeletePress,
}) => {
  const formattedTime = formatAlarmTimeString(alarm.time);
  const remainingText = alarm.enabled
    ? getRemainingTimeText(alarm.targetTimestamp)
    : 'Disabled';

  const handleToggle = (val: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onToggleEnabled(alarm.id, val);
  };

  const handleDelete = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onDeletePress(alarm.id);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onEditPress(alarm)}
      style={[
        styles.cardContainer,
        !alarm.enabled && styles.cardContainerDisabled,
      ]}
    >
      <View style={styles.leftCol}>
        {/* Large Time Display */}
        <Text
          style={[
            styles.timeText,
            !alarm.enabled && styles.timeTextDisabled,
          ]}
        >
          {formattedTime}
        </Text>

        {/* Alarm Label */}
        {alarm.label?.trim() ? (
          <Text
            style={[
              styles.labelText,
              !alarm.enabled && styles.labelTextDisabled,
            ]}
            numberOfLines={1}
          >
            {alarm.label}
          </Text>
        ) : null}

        {/* Live countdown badge */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.countdownBadge,
              !alarm.enabled && styles.countdownBadgeDisabled,
            ]}
          >
            <Ionicons
              name={alarm.enabled ? 'time-outline' : 'pause-outline'}
              size={12}
              color={alarm.enabled ? Colors.accentCyan : Colors.textDisabled}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.countdownText,
                !alarm.enabled && styles.countdownTextDisabled,
              ]}
            >
              {remainingText}
            </Text>
          </View>

          {alarm.vibrate && alarm.enabled && (
            <Ionicons
              name="phone-portrait-outline"
              size={13}
              color={Colors.accentUpcoming}
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
      </View>

      {/* Right Column: Switch & Delete */}
      <View style={styles.rightCol}>
        <Switch
          value={alarm.enabled}
          onValueChange={handleToggle}
          trackColor={{
            false: '#1e3a53',
            true: Colors.primary,
          }}
          thumbColor={alarm.enabled ? Colors.accentCyan : '#789EB7'}
          style={styles.switchControl}
        />

        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Delete alarm"
        >
          <Ionicons name="trash-outline" size={18} color={Colors.textOverdue} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContainerDisabled: {
    backgroundColor: Colors.cardCompleted,
    borderColor: 'transparent',
    opacity: 0.7,
  },
  leftCol: {
    flex: 1,
    paddingRight: 12,
  },
  timeText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  timeTextDisabled: {
    color: Colors.textMuted,
  },
  labelText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  labelTextDisabled: {
    color: Colors.textDisabled,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 195, 247, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countdownBadgeDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accentCyan,
  },
  countdownTextDisabled: {
    color: Colors.textDisabled,
  },
  rightCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchControl: {
    transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }],
    marginBottom: 6,
  },
  deleteBtn: {
    padding: 6,
    marginTop: 2,
  },
});
