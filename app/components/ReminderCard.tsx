import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Reminder } from '../types/reminder';
import { Colors } from '../constants/theme';
import { formatReminderDateTime } from '../services/reminders';
import { formatRepeatSummary } from '../services/recurrence';
import { speakReminderText } from '../services/tts';

interface ReminderCardProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onPostponePress: (reminder: Reminder) => void;
  onDeletePress: (id: string) => void;
  onPressCard?: (reminder: Reminder) => void;
  // Multi-select props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onLongPressCard?: (reminder: Reminder) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onToggleComplete,
  onPostponePress,
  onDeletePress,
  onPressCard,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPressCard,
}) => {
  const { formattedText, isOverdue } = formatReminderDateTime(reminder.dueAt);

  const handleToggle = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore
    }
    onToggleComplete(reminder.id);
  };

  const handleSpeak = () => {
    speakReminderText(reminder.task);
  };

  const handleDelete = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
    onDeletePress(reminder.id);
  };

  const handleCardPress = () => {
    if (isSelectionMode) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
      onToggleSelect?.(reminder.id);
    } else {
      onPressCard?.(reminder);
    }
  };

  const handleLongPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
    if (isSelectionMode) {
      onToggleSelect?.(reminder.id);
    } else {
      onLongPressCard?.(reminder);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleCardPress}
      onLongPress={handleLongPress}
      delayLongPress={300}
      style={[
        styles.cardContainer,
        reminder.completed && styles.cardContainerCompleted,
        isSelectionMode && isSelected && styles.cardContainerSelected,
      ]}
    >
      {/* Selection Mode Checkmark OR Standard Completion Checkbox */}
      {isSelectionMode ? (
        <View style={styles.selectionIndicator}>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isSelected ? Colors.accentCyan : Colors.textSecondary}
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleToggle}
          style={styles.checkboxTouchable}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={reminder.completed ? 'Mark uncompleted' : 'Mark completed'}
        >
          <View
            style={[
              styles.checkboxBox,
              reminder.completed && styles.checkboxBoxChecked,
            ]}
          >
            {reminder.completed && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Task Content */}
      <View style={styles.contentContainer}>
        <Text
          style={[
            styles.taskText,
            reminder.completed && styles.taskTextCompleted,
          ]}
          numberOfLines={2}
        >
          {reminder.task}
        </Text>

        <View style={styles.dueBadgeRow}>
          <Text
            style={[
              styles.dueText,
              isOverdue && !reminder.completed && styles.dueTextOverdue,
              reminder.completed && styles.dueTextCompleted,
            ]}
          >
            {formattedText}
          </Text>

          {reminder.repeat && reminder.repeat.frequency !== 'none' && (
            <View
              style={[
                styles.repeatBadge,
                reminder.completed && styles.repeatBadgeCompleted,
              ]}
            >
              <Ionicons
                name="repeat"
                size={12}
                color={reminder.completed ? Colors.textDisabled : Colors.accentCyan}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.repeatBadgeText,
                  reminder.completed && styles.repeatBadgeTextCompleted,
                ]}
                numberOfLines={1}
              >
                {formatRepeatSummary(reminder.repeat, new Date(reminder.dueAt))}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons (Hidden when in multi-select mode) */}
      {!isSelectionMode && (
        <View style={styles.actionsContainer}>
          {/* Speak Button */}
          {!reminder.completed && (
            <TouchableOpacity
              onPress={handleSpeak}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Speak reminder"
            >
              <Ionicons name="volume-medium-outline" size={20} color={Colors.accentCyan} />
            </TouchableOpacity>
          )}

          {/* Postpone Button */}
          {!reminder.completed && (
            <TouchableOpacity
              onPress={() => onPostponePress(reminder)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Postpone reminder"
            >
              <MaterialCommunityIcons
                name="clock-time-four-outline"
                size={20}
                color={Colors.accentUpcoming}
              />
            </TouchableOpacity>
          )}

          {/* Delete Button (Always readily available) */}
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete reminder"
          >
            <Ionicons
              name="trash-outline"
              size={19}
              color={Colors.textOverdue}
            />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    marginHorizontal: 14,
    marginVertical: 4.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContainerCompleted: {
    backgroundColor: Colors.cardCompleted,
    borderColor: 'transparent',
    opacity: 0.7,
  },
  cardContainerSelected: {
    borderColor: Colors.accentCyan,
    backgroundColor: 'rgba(0, 209, 255, 0.08)',
  },
  selectionIndicator: {
    marginRight: 12,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTouchable: {
    marginRight: 12,
    padding: 2,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.checkboxBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  taskText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
    lineHeight: 21,
  },
  taskTextCompleted: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  dueBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dueText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.accentUpcoming,
  },
  dueTextOverdue: {
    color: Colors.textOverdue,
    fontWeight: '600',
  },
  dueTextCompleted: {
    color: Colors.textDisabled,
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 195, 247, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  repeatBadgeCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  repeatBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accentCyan,
  },
  repeatBadgeTextCompleted: {
    color: Colors.textDisabled,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  actionBtn: {
    padding: 6,
    marginLeft: 2,
  },
});
