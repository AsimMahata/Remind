import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Reminder } from '../types/reminder';
import { Colors, Typography } from '../constants/theme';

interface PostponeModalProps {
  visible: boolean;
  reminder: Reminder | null;
  onClose: () => void;
  onSelectOption: (minutesOrTimestamp: number, isAbsolute: boolean) => void;
  onOpenCustomPicker: () => void;
}

export const PostponeModal: React.FC<PostponeModalProps> = ({
  visible,
  reminder,
  onClose,
  onSelectOption,
  onOpenCustomPicker,
}) => {
  if (!reminder) return null;

  const handlePostponeTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9:00 AM tomorrow
    onSelectOption(tomorrow.getTime(), true);
    onClose();
  };

  const options = [
    {
      label: '15 Minutes',
      subtitle: 'Short delay',
      icon: 'timer-outline',
      action: () => {
        onSelectOption(15, false);
        onClose();
      },
    },
    {
      label: '30 Minutes',
      subtitle: 'Half an hour',
      icon: 'timer-outline',
      action: () => {
        onSelectOption(30, false);
        onClose();
      },
    },
    {
      label: '1 Hour',
      subtitle: 'One hour from now',
      icon: 'clock-time-four-outline',
      action: () => {
        onSelectOption(60, false);
        onClose();
      },
    },
    {
      label: 'Tomorrow Morning',
      subtitle: '9:00 AM tomorrow',
      icon: 'weather-sunny',
      action: handlePostponeTomorrow,
    },
    {
      label: 'Custom Date & Time',
      subtitle: 'Pick exact date and time',
      icon: 'calendar-clock',
      action: () => {
        onClose();
        onOpenCustomPicker();
      },
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons
              name="clock-time-eight-outline"
              size={24}
              color={Colors.textPrimary}
              style={{ marginRight: 8 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Postpone Reminder</Text>
              <Text style={styles.taskName} numberOfLines={1}>
                {reminder.task}
              </Text>
            </View>
          </View>

          {/* Options List */}
          <View style={styles.optionsList}>
            {options.map((opt, idx) => (
              <TouchableOpacity
                key={`opt-${idx}`}
                style={styles.optionItem}
                onPress={opt.action}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={20}
                    color={Colors.accentCyan}
                  />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionSub}>{opt.subtitle}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel Button */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.modalBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.modalBorder,
    overflow: 'hidden',
    elevation: 8,
  },
  header: {
    backgroundColor: Colors.primary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  taskName: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.accentUpcoming,
    marginTop: 2,
  },
  optionsList: {
    paddingVertical: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  optionSub: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    padding: 12,
    alignItems: 'flex-end',
    backgroundColor: Colors.modalBackground,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.fontSizes.sm,
  },
});
