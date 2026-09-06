import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  BackHandler,
  View,
  Animated,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { Reminder, RepeatRule, AppSettings, DEFAULT_SETTINGS } from './types/reminder';
import { Colors } from './constants/theme';
import {
  loadRemindersFromStorage,
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from './services/storage';
import {
  setupNotificationSystem,
  registerNotificationListeners,
} from './services/notifications';
import {
  createReminder,
  toggleReminderCompletion,
  postponeReminder,
  deleteReminder,
  deleteMultipleReminders,
  deleteOverdueReminders,
  clearCompletedReminders,
  updateReminder,
  loadActiveRemindersFromDb,
} from './services/reminders';
import { getDatabase } from './database/sqlite';
import {
  upsertReminder,
  countOfflineReminders,
  assignOfflineRemindersToUser,
} from './database/reminderDao';
import { initializeAuth, subscribeToAuth } from './services/auth';
import { setupSyncEngine, subscribeToSyncData, performSync } from './services/sync';

import { HomeScreen } from './screens/HomeScreen';
import { AddReminderScreen } from './screens/AddReminderScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { EditReminderScreen } from './screens/EditReminderScreen';
import { OfflineMigrationModal } from './components/OfflineMigrationModal';

type ScreenType = 'HOME' | 'ADD_REMINDER' | 'SETTINGS' | 'EDIT_REMINDER';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('HOME');
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  // Offline Migration Prompt State
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);
  const activeUserIdRef = useRef<string | null>(null);

  // Screen transition animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const navigateTo = useCallback((screen: ScreenType) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -24,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen(screen);
      slideAnim.setValue(24);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const navigateBack = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 24,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen('HOME');
      slideAnim.setValue(-24);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  // 1. Initial app load: SQLite Database, Storage, Auth, & Notifications
  useEffect(() => {
    async function initializeApp() {
      try {
        await setupNotificationSystem();
        await getDatabase(); // Ensure SQLite database and tables are created

        // One-time migration: Import any legacy AsyncStorage reminders into SQLite
        const existingInDb = await loadActiveRemindersFromDb();
        if (existingInDb.length === 0) {
          const legacy = await loadRemindersFromStorage();
          if (legacy.length > 0) {
            for (const r of legacy) {
              await upsertReminder({ ...r, syncStatus: 'pending' }, false);
            }
          }
        }

        // Initialize Authentication & Session
        await initializeAuth();

        // Load active reminders & settings
        const [loadedReminders, loadedSettings] = await Promise.all([
          loadActiveRemindersFromDb(),
          loadSettingsFromStorage(),
        ]);
        setReminders(loadedReminders);
        setSettings(loadedSettings);

        // Start background sync listener
        setupSyncEngine();
      } catch (err) {
        console.error('Error during App initialization:', err);
      } finally {
        setIsReady(true);
      }
    }

    initializeApp();
  }, []);

  // 2. Listen to Cloud Sync changes & refresh UI automatically
  useEffect(() => {
    const unsubData = subscribeToSyncData(async () => {
      const refreshed = await loadActiveRemindersFromDb();
      setReminders(refreshed);
    });
    return () => {
      unsubData();
    };
  }, []);

  // 3. Listen to Auth changes: check for offline migration dialog
  useEffect(() => {
    const unsubAuth = subscribeToAuth(async (state) => {
      const previousUserId = activeUserIdRef.current;
      const currentUserId = state.user?.id || null;
      activeUserIdRef.current = currentUserId;

      // When user transitions from logged out to logged in
      if (!previousUserId && currentUserId) {
        const count = await countOfflineReminders();
        if (count > 0) {
          setOfflineCount(count);
          setShowOfflineModal(true);
        }
      }

      // Reload reminders for the active account
      loadActiveRemindersFromDb().then(setReminders);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // 4. Notification action listeners (Finish, Postpone 15m, Postpone 1h)
  useEffect(() => {
    const cleanup = registerNotificationListeners(
      async (reminderId) => {
        setReminders((prev) => {
          toggleReminderCompletion(reminderId, prev).then((updated) => {
            setReminders(updated);
          });
          return prev;
        });
      },
      async (reminderId, minutes) => {
        setReminders((prev) => {
          postponeReminder(reminderId, minutes, false, prev).then((updated) => {
            setReminders(updated);
          });
          return prev;
        });
      }
    );

    return () => {
      cleanup();
    };
  }, []);

  // 5. Android Hardware Back Button Handler
  useEffect(() => {
    const onBackPress = () => {
      if (currentScreen !== 'HOME') {
        if (currentScreen === 'EDIT_REMINDER') {
          setEditingReminder(null);
        }
        navigateBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => backHandler.remove();
  }, [currentScreen, navigateBack]);

  // Handlers for Reminder actions
  const handleToggleComplete = useCallback(async (id: string) => {
    const updated = await toggleReminderCompletion(id, reminders);
    setReminders(updated);
  }, [reminders]);

  const handleDeleteReminder = useCallback(async (id: string) => {
    const updated = await deleteReminder(id, reminders);
    setReminders(updated);
    setEditingReminder((prev) => (prev?.id === id ? null : prev));
  }, [reminders]);

  const handleDeleteMultipleReminders = useCallback(
    async (ids: string[]) => {
      const updated = await deleteMultipleReminders(ids, reminders);
      setReminders(updated);
      setEditingReminder((prev) => (prev && ids.includes(prev.id) ? null : prev));
    },
    [reminders]
  );

  const handleDeleteOverdueReminders = useCallback(async () => {
    const updated = await deleteOverdueReminders(reminders);
    setReminders(updated);
  }, [reminders]);

  const handlePostponeReminder = useCallback(
    async (id: string, minutesOrTimestamp: number, isAbsolute: boolean) => {
      const updated = await postponeReminder(
        id,
        minutesOrTimestamp,
        isAbsolute,
        reminders
      );
      setReminders(updated);
    },
    [reminders]
  );

  const handleCreateReminder = useCallback(
    async (taskText: string, dueAt: number, repeat?: RepeatRule | null, voiceNoteUri?: string | null) => {
      const { updatedList } = await createReminder(taskText, dueAt, reminders, repeat, voiceNoteUri);
      setReminders(updatedList);
    },
    [reminders]
  );

  const handleOpenEditReminder = useCallback(
    (reminder: Reminder) => {
      setEditingReminder(reminder);
      navigateTo('EDIT_REMINDER');
    },
    [navigateTo]
  );

  const handleUpdateReminder = useCallback(
    async (id: string, updates: Partial<Reminder>) => {
      const updated = await updateReminder(id, updates, reminders);
      setReminders(updated);
      setEditingReminder(null);
    },
    [reminders]
  );

  const handleBackFromEdit = useCallback(() => {
    setEditingReminder(null);
    navigateBack();
  }, [navigateBack]);

  const handleQuickAddReminder = useCallback(
    async (taskText: string) => {
      const defaultDueAt = Date.now() + 60 * 60 * 1000;
      const { updatedList } = await createReminder(taskText, defaultDueAt, reminders);
      setReminders(updatedList);
    },
    [reminders]
  );

  const handleClearCompleted = useCallback(async () => {
    const updated = await clearCompletedReminders(reminders);
    setReminders(updated);
  }, [reminders]);

  const handleUpdateSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      await saveSettingsToStorage(merged);
    },
    [settings]
  );

  // Offline migration handlers
  const handleConfirmMigration = async () => {
    setShowOfflineModal(false);
    if (activeUserIdRef.current) {
      await assignOfflineRemindersToUser(activeUserIdRef.current);
      await performSync();
      const refreshed = await loadActiveRemindersFromDb();
      setReminders(refreshed);
    }
  };

  const handleCancelMigration = () => {
    setShowOfflineModal(false);
  };

  return (
    <View style={styles.appContainer}>
      <ExpoStatusBar style="light" />

      <Animated.View
        style={[
          styles.screenAnimatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {currentScreen === 'HOME' && (
          <HomeScreen
            reminders={reminders}
            onToggleComplete={handleToggleComplete}
            onDeleteReminder={handleDeleteReminder}
            onDeleteMultiple={handleDeleteMultipleReminders}
            onDeleteOverdue={handleDeleteOverdueReminders}
            onPostponeReminder={handlePostponeReminder}
            onAddQuickReminder={handleQuickAddReminder}
            onNavigateAdd={() => navigateTo('ADD_REMINDER')}
            onNavigateSettings={() => navigateTo('SETTINGS')}
            onClearCompleted={handleClearCompleted}
            onEditReminder={handleOpenEditReminder}
          />
        )}

        {currentScreen === 'ADD_REMINDER' && (
          <AddReminderScreen
            settings={settings}
            onBack={navigateBack}
            onSaveReminder={handleCreateReminder}
          />
        )}

        {currentScreen === 'SETTINGS' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBack={navigateBack}
            onRefreshReminders={() => {
              loadActiveRemindersFromDb().then(setReminders);
            }}
          />
        )}

        {currentScreen === 'EDIT_REMINDER' && editingReminder && (
          <EditReminderScreen
            key={editingReminder.id}
            reminder={editingReminder}
            settings={settings}
            onBack={handleBackFromEdit}
            onUpdateReminder={handleUpdateReminder}
            onDeleteReminder={handleDeleteReminder}
          />
        )}
      </Animated.View>

      {/* Offline to Online Migration Confirmation Modal */}
      <OfflineMigrationModal
        visible={showOfflineModal}
        count={offlineCount}
        onConfirm={handleConfirmMigration}
        onCancel={handleCancelMigration}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screenAnimatedContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
