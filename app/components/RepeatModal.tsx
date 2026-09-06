import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { RepeatRule, RepeatFrequency, CustomRepeatUnit } from '../types/reminder';
import { formatRepeatSummary } from '../services/recurrence';
import { DatePickerModal } from './DatePickerModal';

interface RepeatModalProps {
  visible: boolean;
  initialRule?: RepeatRule | null;
  baseDate: Date;
  onClose: () => void;
  onConfirm: (rule: RepeatRule | null) => void;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export const RepeatModal: React.FC<RepeatModalProps> = ({
  visible,
  initialRule,
  baseDate,
  onClose,
  onConfirm,
}) => {
  const [frequency, setFrequency] = useState<RepeatFrequency>('none');
  const [interval, setInterval] = useState<number>(1);
  const [unit, setUnit] = useState<CustomRepeatUnit>('weeks');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([baseDate.getDay()]);
  const [hasEndDate, setHasEndDate] = useState<boolean>(false);
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + 1);
    return d;
  });

  const [isEndDatePickerVisible, setIsEndDatePickerVisible] = useState<boolean>(false);

  // Sync state whenever modal is opened
  useEffect(() => {
    if (visible) {
      if (!initialRule || initialRule.frequency === 'none') {
        setFrequency('none');
        setInterval(1);
        setUnit('weeks');
        setDaysOfWeek([baseDate.getDay()]);
        setHasEndDate(false);
      } else {
        setFrequency(initialRule.frequency);
        setInterval(initialRule.interval || 1);
        setUnit(initialRule.unit || 'weeks');
        setDaysOfWeek(
          initialRule.daysOfWeek && initialRule.daysOfWeek.length > 0
            ? initialRule.daysOfWeek
            : [baseDate.getDay()]
        );
        if (initialRule.endDate) {
          setHasEndDate(true);
          setEndDate(new Date(initialRule.endDate));
        } else {
          setHasEndDate(false);
        }
      }
    }
  }, [visible, initialRule, baseDate]);

  const currentConstructedRule: RepeatRule | null = React.useMemo(() => {
    if (frequency === 'none') return null;

    if (frequency === 'daily') {
      return { frequency: 'daily', endDate: hasEndDate ? endDate.getTime() : null };
    }

    if (frequency === 'weekdays') {
      return {
        frequency: 'weekdays',
        daysOfWeek: [1, 2, 3, 4, 5],
        endDate: hasEndDate ? endDate.getTime() : null,
      };
    }

    if (frequency === 'weekly') {
      return {
        frequency: 'weekly',
        daysOfWeek: [baseDate.getDay()],
        endDate: hasEndDate ? endDate.getTime() : null,
      };
    }

    if (frequency === 'monthly') {
      return {
        frequency: 'monthly',
        endDate: hasEndDate ? endDate.getTime() : null,
      };
    }

    if (frequency === 'custom') {
      return {
        frequency: 'custom',
        interval: Math.max(1, interval),
        unit,
        daysOfWeek: unit === 'weeks' ? (daysOfWeek.length > 0 ? daysOfWeek : [baseDate.getDay()]) : undefined,
        endDate: hasEndDate ? endDate.getTime() : null,
      };
    }

    return null;
  }, [frequency, interval, unit, daysOfWeek, hasEndDate, endDate, baseDate]);

  const handleSelectFrequency = (freq: RepeatFrequency) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setFrequency(freq);
  };

  const handleToggleDay = (dayIdx: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setDaysOfWeek((prev) => {
      if (prev.includes(dayIdx)) {
        if (prev.length === 1) return prev; // Keep at least one day selected
        return prev.filter((d) => d !== dayIdx);
      } else {
        return [...prev, dayIdx].sort((a, b) => a - b);
      }
    });
  };

  const handleIncrementInterval = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setInterval((prev) => Math.min(99, prev + 1));
  };

  const handleDecrementInterval = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setInterval((prev) => Math.max(1, prev - 1));
  };

  const handleSave = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    onConfirm(currentConstructedRule);
    onClose();
  };

  const weekdayName = DAY_NAMES[baseDate.getDay()];
  const monthDayOrdinal = getOrdinalSuffix(baseDate.getDate());

  const options: { freq: RepeatFrequency; title: string; subtitle: string }[] = [
    {
      freq: 'none',
      title: 'Does not repeat',
      subtitle: 'One-time reminder only',
    },
    {
      freq: 'daily',
      title: 'Every day',
      subtitle: 'Repeats every day at the same time',
    },
    {
      freq: 'weekdays',
      title: 'Weekdays',
      subtitle: 'Monday through Friday',
    },
    {
      freq: 'weekly',
      title: 'Every week',
      subtitle: `Every ${weekdayName}`,
    },
    {
      freq: 'monthly',
      title: 'Every month',
      subtitle: `On the ${monthDayOrdinal} of each month`,
    },
    {
      freq: 'custom',
      title: 'Custom',
      subtitle: 'Set custom interval, days, and duration',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="repeat" size={20} color={Colors.accentCyan} />
              </View>
              <Text style={styles.headerTitle}>Repeat</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close repeat dialog"
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Options List */}
            <View style={styles.optionsList}>
              {options.map((opt) => {
                const isSelected = frequency === opt.freq;
                return (
                  <TouchableOpacity
                    key={opt.freq}
                    style={[
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                    ]}
                    onPress={() => handleSelectFrequency(opt.freq)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleSelected,
                        ]}
                      >
                        {opt.title}
                      </Text>
                      <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Configuration Section */}
            {frequency === 'custom' && (
              <View style={styles.customSection}>
                <Text style={styles.customSectionHeader}>CUSTOM SETTINGS</Text>

                {/* Repeat Every Row */}
                <View style={styles.customBlock}>
                  <Text style={styles.blockLabel}>Repeat every</Text>
                  <View style={styles.intervalRow}>
                    {/* Stepper */}
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        onPress={handleDecrementInterval}
                        disabled={interval <= 1}
                        style={[
                          styles.stepperBtn,
                          interval <= 1 && styles.stepperBtnDisabled,
                        ]}
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={interval <= 1 ? Colors.textDisabled : Colors.accentCyan}
                        />
                      </TouchableOpacity>
                      <View style={styles.intervalBadge}>
                        <Text style={styles.intervalText}>{interval}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleIncrementInterval}
                        style={styles.stepperBtn}
                      >
                        <Ionicons name="add" size={18} color={Colors.accentCyan} />
                      </TouchableOpacity>
                    </View>

                    {/* Unit Selector */}
                    <View style={styles.unitTabs}>
                      {(['days', 'weeks', 'months'] as CustomRepeatUnit[]).map((u) => {
                        const isUnitSelected = unit === u;
                        return (
                          <TouchableOpacity
                            key={u}
                            onPress={() => {
                              try {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              } catch {}
                              setUnit(u);
                            }}
                            style={[
                              styles.unitTab,
                              isUnitSelected && styles.unitTabSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.unitTabText,
                                isUnitSelected && styles.unitTabTextSelected,
                              ]}
                            >
                              {u === 'days'
                                ? interval === 1 ? 'Day' : 'Days'
                                : u === 'weeks'
                                ? interval === 1 ? 'Week' : 'Weeks'
                                : interval === 1 ? 'Month' : 'Months'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Days of Week Selector (when unit is weeks) */}
                {unit === 'weeks' && (
                  <View style={styles.customBlock}>
                    <Text style={styles.blockLabel}>Repeat on</Text>
                    <View style={styles.daysRow}>
                      {DAY_LETTERS.map((letter, idx) => {
                        const isDaySelected = daysOfWeek.includes(idx);
                        return (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => handleToggleDay(idx)}
                            style={[
                              styles.dayPill,
                              isDaySelected && styles.dayPillSelected,
                            ]}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.dayPillText,
                                isDaySelected && styles.dayPillTextSelected,
                              ]}
                            >
                              {letter}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Ends Section */}
                <View style={styles.customBlock}>
                  <Text style={styles.blockLabel}>Ends</Text>
                  <View style={styles.endsRow}>
                    <TouchableOpacity
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        setHasEndDate(false);
                      }}
                      style={[
                        styles.endsChip,
                        !hasEndDate && styles.endsChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.endsChipText,
                          !hasEndDate && styles.endsChipTextSelected,
                        ]}
                      >
                        Never
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        setHasEndDate(true);
                        setIsEndDatePickerVisible(true);
                      }}
                      style={[
                        styles.endsChip,
                        hasEndDate && styles.endsChipSelected,
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={15}
                        color={hasEndDate ? '#FFFFFF' : Colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.endsChipText,
                          hasEndDate && styles.endsChipTextSelected,
                        ]}
                      >
                        {hasEndDate
                          ? `On ${MONTH_NAMES[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`
                          : 'On date'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Live Summary Preview */}
            <View style={styles.summaryBanner}>
              <Ionicons name="sparkles" size={16} color={Colors.accentCyan} />
              <Text style={styles.summaryText}>
                {formatRepeatSummary(currentConstructedRule, baseDate)}
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              style={styles.saveBtn}
              activeOpacity={0.85}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.saveBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Date Picker Modal for custom end date */}
      <DatePickerModal
        visible={isEndDatePickerVisible}
        initialDate={endDate}
        onClose={() => setIsEndDatePickerVisible(false)}
        onConfirm={(selectedDate) => {
          setEndDate(selectedDate);
          setHasEndDate(true);
          setIsEndDatePickerVisible(false);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    backgroundColor: Colors.modalBackground,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.modalBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(79, 195, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    flexGrow: 0,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionsList: {
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  optionRowSelected: {
    borderColor: Colors.accentCyan,
    backgroundColor: 'rgba(79, 195, 247, 0.08)',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: Colors.accentCyan,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accentCyan,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: Colors.accentCyan,
  },
  optionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  customSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  customSectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accentCyan,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  customBlock: {
    marginBottom: 14,
  },
  blockLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stepperBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  intervalBadge: {
    paddingHorizontal: 8,
    minWidth: 32,
    alignItems: 'center',
  },
  intervalText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  unitTabs: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  unitTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  unitTabSelected: {
    backgroundColor: Colors.primary,
  },
  unitTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  unitTabTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillSelected: {
    backgroundColor: Colors.accentCyan,
    borderColor: Colors.accentCyan,
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dayPillTextSelected: {
    color: '#042236',
  },
  endsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  endsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  endsChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  endsChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  endsChipTextSelected: {
    color: '#FFFFFF',
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 195, 247, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.25)',
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
