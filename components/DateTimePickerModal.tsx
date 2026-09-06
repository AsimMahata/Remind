import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';

interface DateTimePickerModalProps {
  visible: boolean;
  initialDate: Date;
  mode: 'date' | 'time' | 'both';
  onClose: () => void;
  onConfirm: (selectedDate: Date) => void;
}

export const DateTimePickerModal: React.FC<DateTimePickerModalProps> = ({
  visible,
  initialDate,
  mode = 'both',
  onClose,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<'date' | 'time'>(
    mode === 'time' ? 'time' : 'date'
  );
  const [currentDate, setCurrentDate] = useState<Date>(new Date(initialDate));

  // Helper date manipulators
  const updateHour = (h: number, isPM: boolean) => {
    const updated = new Date(currentDate);
    let hour = h % 12;
    if (isPM) hour += 12;
    updated.setHours(hour);
    setCurrentDate(updated);
  };

  const updateMinute = (m: number) => {
    const updated = new Date(currentDate);
    updated.setMinutes(m);
    setCurrentDate(updated);
  };

  const setOffsetHours = (hours: number) => {
    const updated = new Date(Date.now() + hours * 60 * 60 * 1000);
    setCurrentDate(updated);
  };

  const setOffsetMinutes = (mins: number) => {
    const updated = new Date(Date.now() + mins * 60 * 1000);
    setCurrentDate(updated);
  };

  const setPresetDay = (offsetDays: number, defaultHour = 19, defaultMin = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(defaultHour, defaultMin, 0, 0);
    setCurrentDate(d);
  };

  const hoursList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const currentHoursRaw = currentDate.getHours();
  const isPM = currentHoursRaw >= 12;
  const currentHour12 = currentHoursRaw % 12 === 0 ? 12 : currentHoursRaw % 12;
  const currentMinute = currentDate.getMinutes();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          {/* Header */}
          <View style={styles.dialogHeader}>
            <Text style={styles.dialogTitle}>Set Date & Time</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity
                onPress={() => setActiveTab('date')}
                style={[
                  styles.tabButton,
                  activeTab === 'date' && styles.tabButtonActive,
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={activeTab === 'date' ? Colors.textPrimary : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'date' && styles.tabTextActive,
                  ]}
                >
                  Date
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('time')}
                style={[
                  styles.tabButton,
                  activeTab === 'time' && styles.tabButtonActive,
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={activeTab === 'time' ? Colors.textPrimary : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'time' && styles.tabTextActive,
                  ]}
                >
                  Time
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Body Content */}
          <ScrollView style={styles.bodyContent}>
            {activeTab === 'date' ? (
              <View>
                <Text style={styles.sectionLabel}>Quick Date Presets</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setPresetDay(0, currentHoursRaw, currentMinute)}
                  >
                    <Text style={styles.chipText}>Today</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setPresetDay(1, 9, 0)}
                  >
                    <Text style={styles.chipText}>Tomorrow Morning</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setPresetDay(1, 19, 0)}
                  >
                    <Text style={styles.chipText}>Tomorrow Evening</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setPresetDay(2, 9, 0)}
                  >
                    <Text style={styles.chipText}>In 2 Days</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setPresetDay(7, 9, 0)}
                  >
                    <Text style={styles.chipText}>Next Week</Text>
                  </TouchableOpacity>
                </View>

                {/* Selected Date Preview */}
                <View style={styles.selectedPreviewBox}>
                  <Ionicons name="calendar" size={20} color={Colors.accentCyan} />
                  <Text style={styles.selectedPreviewText}>
                    {currentDate.toLocaleDateString([], {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.sectionLabel}>Quick Time Presets</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setOffsetMinutes(15)}
                  >
                    <Text style={styles.chipText}>+15 min</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setOffsetMinutes(30)}
                  >
                    <Text style={styles.chipText}>+30 min</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setOffsetHours(1)}
                  >
                    <Text style={styles.chipText}>+1 hour</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => {
                      const d = new Date(currentDate);
                      d.setHours(20, 0, 0, 0);
                      setCurrentDate(d);
                    }}
                  >
                    <Text style={styles.chipText}>Tonight 8:00 PM</Text>
                  </TouchableOpacity>
                </View>

                {/* Hour Selection */}
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Select Hour</Text>
                <View style={styles.gridRow}>
                  {hoursList.map((h) => {
                    const isSelected = currentHour12 === h;
                    return (
                      <TouchableOpacity
                        key={`hour-${h}`}
                        style={[
                          styles.numButton,
                          isSelected && styles.numButtonSelected,
                        ]}
                        onPress={() => updateHour(h, isPM)}
                      >
                        <Text
                          style={[
                            styles.numText,
                            isSelected && styles.numTextSelected,
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* AM / PM Toggle */}
                <View style={styles.amPmRow}>
                  <TouchableOpacity
                    style={[styles.amPmButton, !isPM && styles.amPmButtonActive]}
                    onPress={() => updateHour(currentHour12, false)}
                  >
                    <Text style={[styles.amPmText, !isPM && styles.amPmTextActive]}>
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.amPmButton, isPM && styles.amPmButtonActive]}
                    onPress={() => updateHour(currentHour12, true)}
                  >
                    <Text style={[styles.amPmText, isPM && styles.amPmTextActive]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Minute Selection */}
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
                  Select Minute
                </Text>
                <View style={styles.gridRow}>
                  {minutesList.map((m) => {
                    const isSelected = Math.abs(currentMinute - m) < 3;
                    return (
                      <TouchableOpacity
                        key={`min-${m}`}
                        style={[
                          styles.numButton,
                          isSelected && styles.numButtonSelected,
                        ]}
                        onPress={() => updateMinute(m)}
                      >
                        <Text
                          style={[
                            styles.numText,
                            isSelected && styles.numTextSelected,
                          ]}
                        >
                          {m < 10 ? `0${m}` : m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.dialogFooter}>
            <TouchableOpacity onPress={onClose} style={styles.dialogBtn}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onConfirm(currentDate);
                onClose();
              }}
              style={[styles.dialogBtn, styles.confirmBtn]}
            >
              <Text style={styles.confirmBtnText}>DONE</Text>
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
  dialogContainer: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: Colors.modalBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.modalBorder,
    overflow: 'hidden',
  },
  dialogHeader: {
    backgroundColor: Colors.primary,
    padding: 16,
  },
  dialogTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryDark,
    borderRadius: 8,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.weights.semiBold,
    marginLeft: 6,
  },
  tabTextActive: {
    color: Colors.textPrimary,
  },
  bodyContent: {
    padding: 16,
    maxHeight: 340,
  },
  sectionLabel: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.accentCyan,
    fontWeight: Typography.weights.semiBold,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.weights.medium,
  },
  selectedPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  selectedPreviewText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.weights.semiBold,
    marginLeft: 10,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  numButton: {
    width: '15%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 6,
    marginBottom: 6,
  },
  numButtonSelected: {
    backgroundColor: Colors.primary,
  },
  numText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.weights.semiBold,
  },
  numTextSelected: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
  },
  amPmRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 10,
  },
  amPmButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  amPmButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.accentCyan,
  },
  amPmText: {
    color: Colors.textSecondary,
    fontWeight: Typography.weights.bold,
  },
  amPmTextActive: {
    color: Colors.textPrimary,
  },
  dialogFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.modalBackground,
  },
  dialogBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
    borderRadius: 4,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.fontSizes.sm,
  },
  confirmBtnText: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.fontSizes.sm,
  },
});
