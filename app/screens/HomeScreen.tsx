import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../types/reminder';
import { Colors } from '../constants/theme';
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
  onDeleteMultiple?: (ids: string[]) => void;
  onDeleteOverdue?: () => void;
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
  onDeleteMultiple,
  onDeleteOverdue,
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

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Overdue count for menu indicator
  const overdueCount = useMemo(() => {
    const now = Date.now();
    return reminders.filter((r) => !r.completed && r.dueAt < now).length;
  }, [reminders]);

  // Intercept back button when multi-select mode is active
  useEffect(() => {
    if (!isSelectionMode) return;
    const onBackPress = () => {
      handleExitSelectionMode();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isSelectionMode]);

  // Selection handlers
  const handleEnterSelectionMode = (initialId?: string) => {
    setIsSelectionMode(true);
    setSelectedIds(initialId ? new Set([initialId]) : new Set());
  };

  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visibleIds = useMemo(() => filteredReminders.map((r) => r.id), [filteredReminders]);
  const isAllSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [visibleIds, selectedIds]
  );

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const handleBatchDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    Alert.alert(
      'Delete Reminders',
      `Move ${count} selected ${count === 1 ? 'reminder' : 'reminders'} to trash?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const idsToDelete = Array.from(selectedIds);
            handleExitSelectionMode();
            onDeleteMultiple?.(idsToDelete);
          },
        },
      ]
    );
  };

  const handleDeleteOverdue = () => {
    if (overdueCount === 0) {
      Alert.alert('No Overdue Reminders', 'You have no overdue reminders to delete.');
      return;
    }

    Alert.alert(
      'Delete All Overdue',
      `Move all ${overdueCount} overdue ${overdueCount === 1 ? 'reminder' : 'reminders'} to trash?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            onDeleteOverdue?.();
          },
        },
      ]
    );
  };

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
      {/* Top App Bar / Selection Header */}
      <Header
        title="Remind"
        showBack={false}
        showSearch={!isSelectionMode}
        onSearchPress={() => {
          setIsSearchActive((prev) => !prev);
          if (isSearchActive) setSearchQuery('');
        }}
        showMenu={!isSelectionMode}
        onMenuPress={() => setIsMenuVisible(true)}
        isSelectionMode={isSelectionMode}
        selectedCount={selectedIds.size}
        onCloseSelection={handleExitSelectionMode}
        onSelectAll={handleToggleSelectAll}
        isAllSelected={isAllSelected}
        onDeleteSelected={handleBatchDeleteSelected}
      />

      {/* Instantaneous Search Bar */}
      {isSearchActive && !isSelectionMode && (
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
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={handleToggleSelect}
            onLongPressCard={() => handleEnterSelectionMode(item.id)}
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

      {/* Bottom Quick Task Bar & FAB (Hidden when multi-selecting) */}
      {!isSelectionMode && (
        <QuickTaskBar
          onAddQuickTask={onAddQuickReminder}
          onFabPress={onNavigateAdd}
          onMicPress={onNavigateAdd}
        />
      )}

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
        onEnterSelectMode={() => handleEnterSelectionMode()}
        onDeleteOverdue={handleDeleteOverdue}
        overdueCount={overdueCount}
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
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    padding: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: Colors.background,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
