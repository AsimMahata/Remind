import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder, ReminderSection } from '../types/reminder';
import { Colors, Typography } from '../constants/theme';
import { Header } from '../components/Header';
import { ReminderCard } from '../components/ReminderCard';
import { QuickTaskBar } from '../components/QuickTaskBar';
import { PostponeModal } from '../components/PostponeModal';
import { TimePickerModal } from '../components/TimePickerModal';
import { MenuDropdown } from '../components/MenuDropdown';
import { organizeRemindersIntoSections } from '../services/reminders';
import { testVoicePlayback } from '../services/tts';

interface HomeScreenProps {
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onPostponeReminder: (id: string, minutesOrTimestamp: number, isAbsolute: boolean) => void;
  onAddQuickReminder: (taskText: string) => void;
  onNavigateAdd: () => void;
  onNavigateSettings: () => void;
  onClearCompleted: () => void;
  onEditReminder: (reminder: Reminder) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  reminders,
  onToggleComplete,
  onDeleteReminder,
  onPostponeReminder,
  onAddQuickReminder,
  onNavigateAdd,
  onNavigateSettings,
  onClearCompleted,
  onEditReminder,
}) => {
  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown menu state
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Postpone modal state
  const [selectedPostponeReminder, setSelectedPostponeReminder] = useState<Reminder | null>(null);

  // Custom DateTimePicker state for custom postpone
  const [isCustomPickerVisible, setIsCustomPickerVisible] = useState(false);
  const [customPostponeReminder, setCustomPostponeReminder] = useState<Reminder | null>(null);

  // Filter reminders based on search query
  const filteredReminders = useMemo(() => {
    if (!searchQuery.trim()) return reminders;
    const query = searchQuery.toLowerCase().trim();
    return reminders.filter((r) => r.task.toLowerCase().includes(query));
  }, [reminders, searchQuery]);

  // Organize into sections (Overdue, Today, Upcoming, Completed)
  const sections = useMemo(() => {
    return organizeRemindersIntoSections(filteredReminders);
  }, [filteredReminders]);

  const handlePostponePress = (reminder: Reminder) => {
    setSelectedPostponeReminder(reminder);
  };

  const handleSelectPostponeOption = (minutesOrTimestamp: number, isAbsolute: boolean) => {
    if (selectedPostponeReminder) {
      onPostponeReminder(selectedPostponeReminder.id, minutesOrTimestamp, isAbsolute);
      setSelectedPostponeReminder(null);
    }
  };

  const handleOpenCustomPicker = () => {
    setCustomPostponeReminder(selectedPostponeReminder);
    setIsCustomPickerVisible(true);
  };

  const handleConfirmCustomDate = (selectedDate: Date) => {
    if (customPostponeReminder) {
      onPostponeReminder(customPostponeReminder.id, selectedDate.getTime(), true);
      setCustomPostponeReminder(null);
    }
  };

  const handleDeleteWithConfirm = (id: string) => {
    onDeleteReminder(id);
  };

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <Header
        title="Remind"
        showBack={false}
        showSearch={true}
        onSearchPress={() => {
          setIsSearchActive((prev) => !prev);
          if (isSearchActive) setSearchQuery('');
        }}
        showMenu={true}
        onMenuPress={() => setIsMenuVisible(true)}
      />

      {/* Instantaneous Search Bar */}
      {isSearchActive && (
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={20} color={Colors.accentCyan} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search reminders..."
            placeholderTextColor={Colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Reminders SectionList */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title, color } }) => (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionHeaderText, { color }]}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ReminderCard
            reminder={item}
            onToggleComplete={onToggleComplete}
            onPostponePress={handlePostponePress}
            onDeletePress={handleDeleteWithConfirm}
            onPressCard={onEditReminder}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching reminders' : 'No reminders'}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? 'Try a different search keyword'
                : 'Tap + or use the quick bar below to add a task'}
            </Text>
          </View>
        }
      />

      {/* Bottom Quick Task Bar & FAB */}
      <QuickTaskBar
        onAddQuickTask={onAddQuickReminder}
        onFabPress={onNavigateAdd}
        onMicPress={onNavigateAdd}
      />

      {/* Postpone Options Modal */}
      <PostponeModal
        visible={!!selectedPostponeReminder}
        reminder={selectedPostponeReminder}
        onClose={() => setSelectedPostponeReminder(null)}
        onSelectOption={handleSelectPostponeOption}
        onOpenCustomPicker={handleOpenCustomPicker}
      />

      {/* Custom Radial Time Picker Dialog for Custom Postpone */}
      <TimePickerModal
        visible={isCustomPickerVisible}
        initialDate={new Date(Date.now() + 60 * 60 * 1000)}
        onClose={() => setIsCustomPickerVisible(false)}
        onConfirm={handleConfirmCustomDate}
      />

      {/* Top-Right Overflow Menu Dropdown */}
      <MenuDropdown
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onNavigateSettings={onNavigateSettings}
        onClearCompleted={onClearCompleted}
        onTestVoice={testVoicePlayback}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.md,
    padding: 0,
  },
  listContent: {
    paddingVertical: 10,
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  emptySub: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
