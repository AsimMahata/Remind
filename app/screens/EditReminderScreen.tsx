import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Reminder, RepeatRule, AppSettings } from '../types/reminder';
import { Colors } from '../constants/theme';
import { Header } from '../components/Header';
import { DatePickerModal } from '../components/DatePickerModal';
import { TimePickerModal } from '../components/TimePickerModal';
import { RepeatModal } from '../components/RepeatModal';
import { VoiceNoteRecorder } from '../components/VoiceNoteRecorder';
import { SpeechInputButton } from '../components/SpeechInputButton';
import { formatRepeatSummary } from '../services/recurrence';
import { speakReminderText } from '../services/tts';
import { useAppInsets } from '../hooks/useAppInsets';

interface EditReminderScreenProps {
  reminder: Reminder;
  settings: AppSettings;
  onBack: () => void;
  onUpdateReminder: (id: string, updates: Partial<Reminder>) => void;
  onDeleteReminder: (id: string) => void;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const EditReminderScreen: React.FC<EditReminderScreenProps> = ({
  reminder,
  settings,
  onBack,
  onUpdateReminder,
  onDeleteReminder,
}) => {
  const { bottomInset } = useAppInsets();
  const [taskText, setTaskText] = useState(reminder.task);
  const [inputHeight, setInputHeight] = useState(34);
  const [dueDate, setDueDate] = useState<Date>(new Date(reminder.dueAt));
  const [isCompleted, setIsCompleted] = useState<boolean>(reminder.completed);
  // Voice note local state (local URI only — never synced)
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(reminder.voiceNoteUri || null);
  const [isVoice, setIsVoice] = useState<boolean>(
    Boolean(reminder.voiceNoteUri || reminder.hasVoiceNote || reminder.isVoice)
  );
  const [isSpeakingPreview, setIsSpeakingPreview] = useState(false);

  // Modals
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [repeatRule, setRepeatRule] = useState<RepeatRule | null>(reminder.repeat || null);
  const [isRepeatModalVisible, setIsRepeatModalVisible] = useState(false);

  const handleSpeakPreview = async () => {
    if (!taskText.trim()) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (isSpeakingPreview) {
      setIsSpeakingPreview(false);
      return;
    }
    setIsSpeakingPreview(true);
    await speakReminderText(taskText.trim(), {
      onDone: () => setIsSpeakingPreview(false),
      onError: () => setIsSpeakingPreview(false),
    });
    setTimeout(() => setIsSpeakingPreview(false), 4000);
  };

  // Format date display
  const formatDateDisplay = (d: Date) => {
    const today = new Date();
    const isToday =
      today.getFullYear() === d.getFullYear() &&
      today.getMonth() === d.getMonth() &&
      today.getDate() === d.getDate();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      tomorrow.getFullYear() === d.getFullYear() &&
      tomorrow.getMonth() === d.getMonth() &&
      tomorrow.getDate() === d.getDate();

    const dateStr = `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    if (isToday) return `Today • ${dateStr}`;
    if (isTomorrow) return `Tomorrow • ${dateStr}`;
    return dateStr;
  };

  // Format time display
  const formatTimeDisplay = (d: Date) => {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? `0${minutes}` : minutes;
    return `${hours}:${minStr} ${ampm}`;
  };

  const handleSave = () => {
    if (!taskText.trim()) {
      Alert.alert('Task Name Required', 'Please enter task text.');
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    onUpdateReminder(reminder.id, {
      task: taskText.trim(),
      dueAt: dueDate.getTime(),
      completed: isCompleted,
      repeat: repeatRule,
      voiceNoteUri: voiceNoteUri,
      isVoice: isVoice || !!voiceNoteUri,
    });
    onBack();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
            onDeleteReminder(reminder.id);
            onBack();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleToggleComplete = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setIsCompleted((prev) => !prev);
  };

  const handlePresetMinutes = (offsetMinutes: number) => {
    const baseTime = Math.max(Date.now(), dueDate.getTime());
    const d = new Date(baseTime + offsetMinutes * 60 * 1000);
    setDueDate(d);
  };

  const handleTonight = () => {
    const d = new Date();
    d.setHours(20, 0, 0, 0); // 8:00 PM
    if (d.getTime() < Date.now()) {
      d.setDate(d.getDate() + 1);
    }
    setDueDate(d);
  };

  const handleTomorrowMorning = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0); // 9:00 AM
    setDueDate(d);
  };


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="Edit Task"
        showBack={true}
        onBack={onBack}
        showSearch={false}
        showMenu={false}
        rightElement={
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.headerDeleteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Delete task"
            >
              <Ionicons name="trash-outline" size={22} color={Colors.textOverdue} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.headerSaveBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Save task"
            >
              <Ionicons name="checkmark-sharp" size={24} color={Colors.accentCyan} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1: Task Title Card */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>TASK DESCRIPTION</Text>
          <View style={styles.inputCard}>
            <TextInput
              value={taskText}
              onChangeText={setTaskText}
              placeholder="What needs to be done?"
              placeholderTextColor={Colors.placeholder}
              style={[
                styles.textInput,
                {
                  height: Math.max(34, Math.min(120, inputHeight)),
                  textAlignVertical: inputHeight > 42 ? 'top' : 'center',
                },
              ]}
              multiline
              onContentSizeChange={(e) => {
                const h = e.nativeEvent.contentSize.height;
                if (h > 0) {
                  setInputHeight(h);
                }
              }}
            />
            {settings.voiceInputEnabled && (
              <SpeechInputButton
                currentText={taskText}
                onSpeechResult={(spokenText) => {
                  setIsVoice(true);
                  setTaskText((prev) => (prev && prev.trim() ? `${prev.trim()} ${spokenText}` : spokenText));
                }}
              />
            )}
            {taskText.trim().length > 0 && (
              <TouchableOpacity
                onPress={handleSpeakPreview}
                style={[
                  styles.ttsPreviewBtn,
                  isSpeakingPreview && styles.ttsPreviewBtnActive,
                ]}
                accessibilityLabel="Listen with Text-to-Speech"
              >
                <Ionicons
                  name={isSpeakingPreview ? 'volume-high' : 'volume-medium-outline'}
                  size={20}
                  color={isSpeakingPreview ? Colors.accentCyan : Colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Voice Note Section — only visible when voiceNotesEnabled is ON */}
        {settings.voiceNotesEnabled && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionLabel}>VOICE NOTE</Text>
            <VoiceNoteRecorder
              existingUri={voiceNoteUri}
              hasVoiceNoteOnServer={!voiceNoteUri && !!reminder.hasVoiceNote}
              onRecordingChange={(uri) => {
                setVoiceNoteUri(uri);
                if (uri) setIsVoice(true);
              }}
            />
          </View>
        )}

        {/* Section 2: Date & Time Selector */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>DATE & TIME</Text>

          {/* Date Row */}
          <TouchableOpacity
            onPress={() => setIsDatePickerVisible(true)}
            style={styles.pickerRow}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={22}
                color={Colors.accentCyan}
              />
            </View>
            <View style={styles.pickerInfo}>
              <Text style={styles.pickerLabel}>Date</Text>
              <Text style={styles.pickerValue}>{formatDateDisplay(dueDate)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Time Row */}
          <TouchableOpacity
            onPress={() => setIsTimePickerVisible(true)}
            style={[styles.pickerRow, { marginTop: 10 }]}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name="clock-time-four-outline"
                size={22}
                color={Colors.accentCyan}
              />
            </View>
            <View style={styles.pickerInfo}>
              <Text style={styles.pickerLabel}>Time</Text>
              <Text style={styles.pickerValue}>{formatTimeDisplay(dueDate)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Section 3: Repeat / Recurrence Selection */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>REPEAT</Text>
          <TouchableOpacity
            onPress={() => setIsRepeatModalVisible(true)}
            style={styles.pickerRow}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name="repeat"
                size={22}
                color={Colors.accentCyan}
              />
            </View>
            <View style={styles.pickerInfo}>
              <Text style={styles.pickerLabel}>Frequency</Text>
              <Text style={styles.pickerValue}>
                {formatRepeatSummary(repeatRule, dueDate)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Repeat Quick Presets Chips */}
          <View style={[styles.chipsRow, { marginTop: 10 }]}>
            <TouchableOpacity
              style={[
                styles.chip,
                (!repeatRule || repeatRule.frequency === 'none') && styles.chipActive,
              ]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setRepeatRule(null);
              }}
            >
              <Text style={[
                styles.chipText,
                (!repeatRule || repeatRule.frequency === 'none') && styles.chipTextActive,
              ]}>
                Does not repeat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                repeatRule?.frequency === 'daily' && styles.chipActive,
              ]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setRepeatRule({ frequency: 'daily' });
              }}
            >
              <Ionicons
                name="repeat"
                size={15}
                color={repeatRule?.frequency === 'daily' ? '#042236' : Colors.accentCyan}
              />
              <Text style={[
                styles.chipText,
                repeatRule?.frequency === 'daily' && styles.chipTextActive,
              ]}>
                Every day
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                repeatRule?.frequency === 'weekdays' && styles.chipActive,
              ]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setRepeatRule({ frequency: 'weekdays', daysOfWeek: [1, 2, 3, 4, 5] });
              }}
            >
              <Text style={[
                styles.chipText,
                repeatRule?.frequency === 'weekdays' && styles.chipTextActive,
              ]}>
                Weekdays
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                repeatRule?.frequency === 'weekly' && styles.chipActive,
              ]}
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setRepeatRule({ frequency: 'weekly', daysOfWeek: [dueDate.getDay()] });
              }}
            >
              <Text style={[
                styles.chipText,
                repeatRule?.frequency === 'weekly' && styles.chipTextActive,
              ]}>
                Every week
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                repeatRule?.frequency === 'custom' && styles.chipActive,
              ]}
              onPress={() => {
                setIsRepeatModalVisible(true);
              }}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={repeatRule?.frequency === 'custom' ? '#042236' : Colors.accentCyan}
              />
              <Text style={[
                styles.chipText,
                repeatRule?.frequency === 'custom' && styles.chipTextActive,
              ]}>
                Custom...
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 3: Status Toggle Card */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>STATUS</Text>
          <TouchableOpacity
            onPress={handleToggleComplete}
            style={[
              styles.statusCard,
              isCompleted && styles.statusCardCompleted,
            ]}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkboxBox,
                isCompleted && styles.checkboxBoxChecked,
              ]}
            >
              {isCompleted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>
                {isCompleted ? 'Completed' : 'Pending'}
              </Text>
              <Text style={styles.statusSub}>
                {isCompleted
                  ? 'Task finished • tap to reopen'
                  : 'Active task • tap to mark complete'}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                isCompleted ? styles.statusBadgeCompleted : styles.statusBadgePending,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isCompleted ? styles.statusBadgeTextCompleted : styles.statusBadgeTextPending,
                ]}
              >
                {isCompleted ? 'Finished' : 'Mark Done'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 4: Quick Postpone Chips */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>QUICK POSTPONE</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => handlePresetMinutes(15)}
            >
              <Ionicons name="timer-outline" size={16} color={Colors.accentCyan} />
              <Text style={styles.chipText}>+15 Min</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={() => handlePresetMinutes(60)}
            >
              <Ionicons name="time-outline" size={16} color={Colors.accentCyan} />
              <Text style={styles.chipText}>+1 Hour</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={handleTonight}
            >
              <MaterialCommunityIcons name="weather-night" size={16} color={Colors.accentCyan} />
              <Text style={styles.chipText}>Tonight 8 PM</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={handleTomorrowMorning}
            >
              <MaterialCommunityIcons name="weather-sunny" size={16} color={Colors.accentCyan} />
              <Text style={styles.chipText}>Tomorrow 9 AM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 5: Delete Button */}
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteButton}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.textOverdue} />
          <Text style={styles.deleteButtonText}>Delete Task</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Save Button */}
      <TouchableOpacity
        onPress={handleSave}
        style={styles.fabSave}
        activeOpacity={0.85}
        accessibilityLabel="Save changes"
      >
        <Ionicons name="checkmark" size={32} color={Colors.fabIcon} />
      </TouchableOpacity>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={isDatePickerVisible}
        initialDate={dueDate}
        onClose={() => setIsDatePickerVisible(false)}
        onConfirm={(selectedDate) => {
          const updated = new Date(dueDate);
          updated.setFullYear(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate()
          );
          setDueDate(updated);
          setIsDatePickerVisible(false);
        }}
      />

      {/* Radial Time Picker Modal */}
      <TimePickerModal
        visible={isTimePickerVisible}
        initialDate={dueDate}
        onClose={() => setIsTimePickerVisible(false)}
        onConfirm={(selectedTime) => {
          const updated = new Date(dueDate);
          updated.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
          setDueDate(updated);
          setIsTimePickerVisible(false);
        }}
      />

      {/* Repeat Recurrence Modal */}
      <RepeatModal
        visible={isRepeatModalVisible}
        initialRule={repeatRule}
        baseDate={dueDate}
        onClose={() => setIsRepeatModalVisible(false)}
        onConfirm={(rule) => {
          setRepeatRule(rule);
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDeleteBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerSaveBtn: {
    padding: 6,
    marginRight: 4,
  },
  cardSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accentCyan,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  micButton: {
    padding: 6,
    marginLeft: 8,
  },
  ttsPreviewBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginLeft: 6,
  },
  ttsPreviewBtnActive: {
    backgroundColor: 'rgba(0, 210, 255, 0.2)',
  },
  pickerRow: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(79, 195, 247, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  pickerInfo: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  pickerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusCardCompleted: {
    backgroundColor: Colors.cardCompleted,
    borderColor: 'transparent',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.checkboxBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statusSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginLeft: 8,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(79, 195, 247, 0.14)',
  },
  statusBadgeCompleted: {
    backgroundColor: 'rgba(129, 199, 132, 0.16)',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusBadgeTextPending: {
    color: Colors.accentCyan,
  },
  statusBadgeTextCompleted: {
    color: Colors.accentCompleted,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: Colors.accentCyan,
    borderColor: Colors.accentCyan,
  },
  chipText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  chipTextActive: {
    color: '#042236',
    fontWeight: '700',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 138, 128, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 128, 0.25)',
    marginTop: 10,
    marginBottom: 40,
  },
  deleteButtonText: {
    color: Colors.textOverdue,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  fabSave: {
    position: 'absolute',
    right: 22,
    bottom: 26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.fabBackground,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
});
