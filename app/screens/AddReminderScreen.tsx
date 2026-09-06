import React, { useState, useEffect } from 'react';
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
import { Colors, Typography } from '../constants/theme';
import { Header } from '../components/Header';
import { DatePickerModal } from '../components/DatePickerModal';
import { TimePickerModal } from '../components/TimePickerModal';
import { RepeatModal } from '../components/RepeatModal';
import { VoiceNoteRecorder } from '../components/VoiceNoteRecorder';
import { SpeechInputButton } from '../components/SpeechInputButton';
import { getIntelligentSuggestedTime, getDefaultColdStartTime } from '../services/suggestions';
import { formatRepeatSummary } from '../services/recurrence';
import { RepeatRule, AppSettings } from '../types/reminder';
import { useAppInsets } from '../hooks/useAppInsets';

interface AddReminderScreenProps {
  settings: AppSettings;
  onBack: () => void;
  onSaveReminder: (task: string, dueAt: number, repeat?: RepeatRule | null, voiceNoteUri?: string | null) => void;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const AddReminderScreen: React.FC<AddReminderScreenProps> = ({
  settings,
  onBack,
  onSaveReminder,
}) => {
  const { bottomInset } = useAppInsets();
  const [taskText, setTaskText] = useState('');
  const [inputHeight, setInputHeight] = useState(34);
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  // Initialize with the cold-start rule (:00 hour) on TODAY
  const [dueDate, setDueDate] = useState<Date>(() => {
    const d = getDefaultColdStartTime();
    const now = new Date();
    d.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    return d;
  });
  const [suggestionData, setSuggestionData] = useState<{
    date: Date;
    isHabitBased: boolean;
    count: number;
  } | null>(null);

  useEffect(() => {
    getIntelligentSuggestedTime().then((res) => {
      // Guarantee date is strictly today
      const todayDate = new Date(res.suggestedDate);
      const now = new Date();
      todayDate.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());

      setDueDate(todayDate);
      setSuggestionData({
        date: todayDate,
        isHabitBased: res.isHabitBased,
        count: res.frequencyCount,
      });
    });
  }, []);

  // Separate modal states
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [repeatRule, setRepeatRule] = useState<RepeatRule | null>(null);
  const [isRepeatModalVisible, setIsRepeatModalVisible] = useState(false);

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
      Alert.alert('Task Name Required', 'Please enter what needs to be done.');
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }

    onSaveReminder(taskText.trim(), dueDate.getTime(), repeatRule, voiceNoteUri);
    onBack();
  };

  const handlePresetMinutes = (offsetMinutes: number) => {
    const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
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
        title="New Task"
        showBack={true}
        onBack={onBack}
        showSearch={false}
        showMenu={false}
      />

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1: Task Input Card */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>WHAT IS TO BE DONE?</Text>
          <View style={styles.inputCard}>
            <TextInput
              value={taskText}
              onChangeText={setTaskText}
              placeholder="e.g. Call client about proposal..."
              placeholderTextColor={Colors.placeholder}
              style={[
                styles.textInput,
                {
                  height: Math.max(34, Math.min(120, inputHeight)),
                  textAlignVertical: inputHeight > 42 ? 'top' : 'center',
                },
              ]}
              autoFocus
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
                  setTaskText((prev) => (prev && prev.trim() ? `${prev.trim()} ${spokenText}` : spokenText));
                }}
              />
            )}
          </View>
        </View>

        {/* Voice Note Section — only visible when voiceNotesEnabled is ON */}
        {settings.voiceNotesEnabled && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionLabel}>VOICE NOTE</Text>
            <VoiceNoteRecorder
              existingUri={voiceNoteUri}
              onRecordingChange={setVoiceNoteUri}
            />
          </View>
        )}

        {/* Section 2: Separate Date & Time Selection */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>WHEN SHOULD WE REMIND YOU?</Text>

          {/* Date Selector Row */}
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

          {/* Time Selector Row */}
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

        {/* Intelligent Time Suggestion Card */}
        {suggestionData && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionLabel}>INTELLIGENT SUGGESTION</Text>
            <TouchableOpacity
              style={styles.smartSuggestionCard}
              onPress={() => setDueDate(suggestionData.date)}
              activeOpacity={0.8}
            >
              <View style={styles.smartIconContainer}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.smartHeaderRow}>
                  <Text style={styles.smartSuggestedTime}>
                    {formatTimeDisplay(suggestionData.date)}
                  </Text>
                  <View style={styles.smartBadge}>
                    <Text style={styles.smartBadgeText}>
                      {suggestionData.isHabitBased ? 'LEARNED HABIT' : 'AUTO HOUR :00'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.smartReasonText}>
                  {suggestionData.isHabitBased
                    ? `Frequent pattern based on ${suggestionData.count} past reminders`
                    : `Cold-start heuristic (${suggestionData.count}/10 entries collected)`}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Section 3: Quick Schedule Chips */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>QUICK PRESETS</Text>
          <View style={styles.chipsRow}>
            {suggestionData && (
              <TouchableOpacity
                style={[styles.chip, styles.smartPresetChip]}
                onPress={() => setDueDate(suggestionData.date)}
              >
                <Ionicons name="sparkles" size={14} color="#0078B7" />
                <Text style={[styles.chipText, styles.smartPresetChipText]}>
                  {formatTimeDisplay(suggestionData.date)}
                </Text>
              </TouchableOpacity>
            )}

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

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="notifications-outline" size={18} color={Colors.accentCyan} />
          <Text style={styles.infoBannerText}>
            Full alert notification{settings.voiceReminderEnabled ? ' and voice reminder' : ''} will trigger at the chosen time.
          </Text>
        </View>
      </ScrollView>

      {/* Floating Action Save Button */}
      <TouchableOpacity
        onPress={handleSave}
        style={styles.fabSave}
        activeOpacity={0.85}
        accessibilityLabel="Save reminder"
      >
        <Ionicons name="checkmark" size={32} color={Colors.fabIcon} />
      </TouchableOpacity>

      {/* Separate Dedicated Date Picker Modal (Calendar) */}
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

      {/* Separate Dedicated Radial Time Picker Modal (Matching Reference image.png) */}
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 195, 247, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.2)',
    marginTop: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 10,
    lineHeight: 18,
  },
  smartSuggestionCard: {
    backgroundColor: '#073656',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0288D1',
    elevation: 3,
    shadowColor: '#0288D1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  smartIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0288D1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  smartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  smartSuggestedTime: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  smartBadge: {
    backgroundColor: 'rgba(79, 195, 247, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  smartBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accentCyan,
    letterSpacing: 0.5,
  },
  smartReasonText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  smartPresetChip: {
    backgroundColor: 'rgba(2, 136, 209, 0.25)',
    borderColor: '#0288D1',
  },
  smartPresetChipText: {
    color: Colors.accentCyan,
    fontWeight: '700',
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
