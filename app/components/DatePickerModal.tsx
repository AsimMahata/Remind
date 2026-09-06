import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface DatePickerModalProps {
  visible: boolean;
  initialDate: Date;
  onClose: () => void;
  onConfirm: (selectedDate: Date) => void;
}

type PickerMode = 'DAY' | 'MONTH' | 'YEAR';

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const START_YEAR = 1970;
const END_YEAR = 2060;

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  initialDate,
  onClose,
  onConfirm,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(initialDate));
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());
  const [mode, setMode] = useState<PickerMode>('DAY');

  const yearScrollRef = useRef<ScrollView>(null);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      list.push(y);
    }
    return list;
  }, []);

  useEffect(() => {
    if (visible) {
      const d = new Date(initialDate);
      setSelectedDate(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setMode('DAY');
    }
  }, [visible, initialDate]);

  // Auto-scroll to selected year when YEAR mode is opened
  useEffect(() => {
    if (mode === 'YEAR') {
      const rowIndex = Math.floor((viewYear - START_YEAR) / 3);
      const timer = setTimeout(() => {
        yearScrollRef.current?.scrollTo({
          y: Math.max(0, rowIndex * 50 - 80),
          animated: true,
        });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [mode, viewYear]);

  // Navigate back/forward
  const handlePrev = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (mode === 'DAY') {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((prev) => prev - 1);
      } else {
        setViewMonth((prev) => prev - 1);
      }
    } else if (mode === 'MONTH') {
      setViewYear((prev) => prev - 1);
    } else if (mode === 'YEAR') {
      setViewYear((prev) => Math.max(START_YEAR, prev - 12));
    }
  };

  const handleNext = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (mode === 'DAY') {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((prev) => prev + 1);
      } else {
        setViewMonth((prev) => prev + 1);
      }
    } else if (mode === 'MONTH') {
      setViewYear((prev) => prev + 1);
    } else if (mode === 'YEAR') {
      setViewYear((prev) => Math.min(END_YEAR, prev + 12));
    }
  };

  // Quick shortcuts
  const selectToday = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const today = new Date();
    const updated = new Date(selectedDate);
    updated.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    setSelectedDate(updated);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setMode('DAY');
  };

  const selectTomorrow = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const updated = new Date(selectedDate);
    updated.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setSelectedDate(updated);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setMode('DAY');
  };

  const selectNextWeek = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const updated = new Date(selectedDate);
    updated.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setSelectedDate(updated);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setMode('DAY');
  };

  const handleDaySelect = (day: number) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const updated = new Date(selectedDate);
    updated.setFullYear(viewYear, viewMonth, day);
    setSelectedDate(updated);
  };

  const handleMonthSelect = (monthIndex: number) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setViewMonth(monthIndex);
    const daysInNewMonth = new Date(viewYear, monthIndex + 1, 0).getDate();
    const updated = new Date(selectedDate);
    const safeDay = Math.min(updated.getDate(), daysInNewMonth);
    updated.setFullYear(viewYear, monthIndex, safeDay);
    setSelectedDate(updated);
    setMode('DAY');
  };

  const handleYearSelect = (year: number) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setViewYear(year);
    const daysInNewMonth = new Date(year, viewMonth + 1, 0).getDate();
    const updated = new Date(selectedDate);
    const safeDay = Math.min(updated.getDate(), daysInNewMonth);
    updated.setFullYear(year, viewMonth, safeDay);
    setSelectedDate(updated);
    setMode('DAY');
  };

  // Build calendar matrix
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday

  const calendarDays: Array<{ day: number; currentMonth: boolean }> = [];

  // Previous month trailing days
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, currentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, currentMonth: true });
  }

  // Next month leading days to complete grid (multiples of 7)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, currentMonth: false });
  }

  const today = new Date();
  const isSelectedDate = (day: number) => {
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const isTodayDate = (day: number) => {
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  const dayOfWeekStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][selectedDate.getDay()];
  const monthShortStr = MONTH_ABBR[selectedDate.getMonth()];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          {/* Header Banner - Industry Standard Material Design */}
          <View style={styles.headerBanner}>
            <TouchableOpacity
              onPress={() => setMode(mode === 'YEAR' ? 'DAY' : 'YEAR')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.headerYear,
                  mode === 'YEAR' && styles.headerYearActive,
                ]}
              >
                {selectedDate.getFullYear()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMode('DAY')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.headerFormattedDate,
                  mode === 'DAY' && styles.headerDateActive,
                ]}
              >
                {dayOfWeekStr}, {monthShortStr} {selectedDate.getDate()}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Month & Year Bar with Dropdown Pills */}
          <View style={styles.monthNavBar}>
            <TouchableOpacity
              onPress={handlePrev}
              style={styles.navBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Previous"
            >
              <Ionicons name="chevron-back" size={20} color="#333333" />
            </TouchableOpacity>

            <View style={styles.selectorsRow}>
              {/* Month Dropdown Pill */}
              <TouchableOpacity
                onPress={() => setMode(mode === 'MONTH' ? 'DAY' : 'MONTH')}
                style={[
                  styles.selectorChip,
                  mode === 'MONTH' && styles.selectorChipActive,
                ]}
                activeOpacity={0.7}
                accessibilityLabel="Select month"
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    mode === 'MONTH' && styles.selectorChipTextActive,
                  ]}
                >
                  {MONTH_NAMES[viewMonth]}
                </Text>
                <Ionicons
                  name={mode === 'MONTH' ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={mode === 'MONTH' ? '#0288D1' : '#666666'}
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>

              {/* Year Dropdown Pill */}
              <TouchableOpacity
                onPress={() => setMode(mode === 'YEAR' ? 'DAY' : 'YEAR')}
                style={[
                  styles.selectorChip,
                  mode === 'YEAR' && styles.selectorChipActive,
                ]}
                activeOpacity={0.7}
                accessibilityLabel="Select year"
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    mode === 'YEAR' && styles.selectorChipTextActive,
                  ]}
                >
                  {viewYear}
                </Text>
                <Ionicons
                  name={mode === 'YEAR' ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={mode === 'YEAR' ? '#0288D1' : '#666666'}
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleNext}
              style={styles.navBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Next"
            >
              <Ionicons name="chevron-forward" size={20} color="#333333" />
            </TouchableOpacity>
          </View>

          {/* Consistent Height Body: DAY, MONTH, or YEAR view */}
          <View style={styles.bodyContainer}>
            {/* VIEW 1: Standard Calendar Day Matrix */}
            {mode === 'DAY' && (
              <View style={styles.dayViewContent}>
                {/* Weekday Headers */}
                <View style={styles.weekdaysRow}>
                  {DAYS_OF_WEEK.map((d, index) => (
                    <Text key={`weekday-${index}`} style={styles.weekdayText}>
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {calendarDays.map((item, index) => {
                    if (!item.currentMonth) {
                      return (
                        <View key={`grid-${index}`} style={styles.dayCell}>
                          <Text style={styles.otherMonthText}>{item.day}</Text>
                        </View>
                      );
                    }

                    const selected = isSelectedDate(item.day);
                    const isToday = isTodayDate(item.day);

                    return (
                      <TouchableOpacity
                        key={`grid-${index}`}
                        onPress={() => handleDaySelect(item.day)}
                        style={[
                          styles.dayCell,
                          selected && styles.dayCellSelected,
                          isToday && !selected && styles.dayCellToday,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            selected && styles.dayTextSelected,
                            isToday && !selected && styles.dayTextToday,
                          ]}
                        >
                          {item.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Quick Shortcuts */}
                <View style={styles.shortcutsRow}>
                  <TouchableOpacity onPress={selectToday} style={styles.shortcutChip}>
                    <Text style={styles.shortcutText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={selectTomorrow} style={styles.shortcutChip}>
                    <Text style={styles.shortcutText}>Tomorrow</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={selectNextWeek} style={styles.shortcutChip}>
                    <Text style={styles.shortcutText}>+1 Week</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* VIEW 2: 12-Month Quick Grid */}
            {mode === 'MONTH' && (
              <View style={styles.monthGridContainer}>
                <Text style={styles.viewSubHeader}>Select Month ({viewYear})</Text>
                <View style={styles.monthGrid}>
                  {MONTH_ABBR.map((abbr, index) => {
                    const isSelected = viewMonth === index;
                    const isCurrentMonth =
                      today.getMonth() === index && today.getFullYear() === viewYear;

                    return (
                      <TouchableOpacity
                        key={`month-${index}`}
                        onPress={() => handleMonthSelect(index)}
                        style={[
                          styles.monthCell,
                          isSelected && styles.monthCellSelected,
                          isCurrentMonth && !isSelected && styles.monthCellCurrent,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.monthCellText,
                            isSelected && styles.monthCellTextSelected,
                            isCurrentMonth && !isSelected && styles.monthCellTextCurrent,
                          ]}
                        >
                          {abbr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* VIEW 3: Scrollable Year Grid */}
            {mode === 'YEAR' && (
              <View style={styles.yearViewContainer}>
                <Text style={styles.viewSubHeader}>Select Year</Text>
                <ScrollView
                  ref={yearScrollRef}
                  style={styles.yearScroll}
                  contentContainerStyle={styles.yearGrid}
                  showsVerticalScrollIndicator={true}
                >
                  {years.map((y) => {
                    const isSelected = viewYear === y;
                    const isCurrentYear = today.getFullYear() === y;

                    return (
                      <TouchableOpacity
                        key={`year-${y}`}
                        onPress={() => handleYearSelect(y)}
                        style={[
                          styles.yearCell,
                          isSelected && styles.yearCellSelected,
                          isCurrentYear && !isSelected && styles.yearCellCurrent,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.yearCellText,
                            isSelected && styles.yearCellTextSelected,
                            isCurrentYear && !isSelected && styles.yearCellTextCurrent,
                          ]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Footer Actions */}
          <View style={styles.actionsFooter}>
            <TouchableOpacity onPress={onClose} style={styles.footerBtn}>
              <Text style={styles.footerBtnText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onConfirm(selectedDate)}
              style={styles.footerBtn}
            >
              <Text style={[styles.footerBtnText, styles.okBtnText]}>OK</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  headerBanner: {
    backgroundColor: '#0288D1',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  headerYear: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '600',
    marginBottom: 2,
  },
  headerYearActive: {
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  headerFormattedDate: {
    fontSize: 26,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  headerDateActive: {
    fontWeight: '500',
  },
  monthNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  navBtn: {
    padding: 6,
  },
  selectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  selectorChipActive: {
    backgroundColor: 'rgba(2, 136, 209, 0.12)',
    borderColor: '#0288D1',
  },
  selectorChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  selectorChipTextActive: {
    color: '#0288D1',
  },
  bodyContainer: {
    minHeight: 290,
    justifyContent: 'flex-start',
  },
  dayViewContent: {
    paddingTop: 6,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  weekdayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1.5,
    borderRadius: 19,
  },
  dayCellSelected: {
    backgroundColor: '#0288D1',
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: '#0288D1',
  },
  dayText: {
    fontSize: 14,
    color: '#222222',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextToday: {
    color: '#0288D1',
    fontWeight: '700',
  },
  otherMonthText: {
    fontSize: 13,
    color: '#CCCCCC',
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  shortcutChip: {
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  shortcutText: {
    fontSize: 12,
    color: '#0288D1',
    fontWeight: '600',
  },
  viewSubHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0288D1',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  monthGridContainer: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  monthCell: {
    width: '31%',
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthCellSelected: {
    backgroundColor: '#0288D1',
    borderColor: '#0288D1',
  },
  monthCellCurrent: {
    borderColor: '#0288D1',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  monthCellText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
  monthCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  monthCellTextCurrent: {
    color: '#0288D1',
    fontWeight: '700',
  },
  yearViewContainer: {
    paddingHorizontal: 12,
  },
  yearScroll: {
    height: 250,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingTop: 4,
  },
  yearCell: {
    width: '31%',
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yearCellSelected: {
    backgroundColor: '#0288D1',
    borderColor: '#0288D1',
  },
  yearCellCurrent: {
    borderColor: '#0288D1',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  yearCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  yearCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  yearCellTextCurrent: {
    color: '#0288D1',
    fontWeight: '700',
  },
  actionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0288D1',
    letterSpacing: 0.5,
  },
  okBtnText: {
    color: '#0288D1',
  },
});
