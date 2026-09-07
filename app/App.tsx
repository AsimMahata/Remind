import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  BackHandler,
  View,
  Animated,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { Reminder, RepeatRule, AppSettings, DEFAULT_SETTINGS } from './types/reminder';
import { Alarm } from './types/alarm';
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
import {
  getAllAlarmsFromDb,
  upsertAlarmInDb,
  deleteAlarmFromDb,
  setAlarmEnabledInDb,
} from './database/alarmDao';
import {
  setupAlarmSystem,
  scheduleAlarm,
  cancelAlarm,
  dismissAlarm,
  snoozeAlarm,
  registerAlarmNotificationListeners,
  subscribeToRingingAlarm,
} from './services/alarmEngine';
import { initializeAuth, subscribeToAuth } from './services/auth';
import { setupSyncEngine, subscribeToSyncData, performSync } from './services/sync';

import { HomeScreen } from './screens/HomeScreen';
import { AlarmsScreen } from './screens/AlarmsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AddReminderScreen } from './screens/AddReminderScreen';
import { EditReminderScreen } from './screens/EditReminderScreen';
import { BottomNavDock, PrimaryTab } from './components/BottomNavDock';
import { AlarmRingingModal } from './components/AlarmRingingModal';
import { OfflineMigrationModal } from './components/OfflineMigrationModal';
import { ErrorBoundary } from './components/ErrorBoundary';

type ScreenType = 'REMINDERS' | 'ALARMS' | 'SETTINGS' | 'ADD_REMINDER' | 'EDIT_REMINDER';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('REMINDERS');
  const [activeTab, setActiveTab] = useState<PrimaryTab>('REMINDERS');
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  
  // Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // Alarms state (100% local, separate from backend & cloud sync)
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activeRingingAlarm, setActiveRingingAlarm] = useState<Alarm | null>(null);
  
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
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -16,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen(screen);
      if (screen === 'REMINDERS' || screen === 'ALARMS' || screen === 'SETTINGS') {
        setActiveTab(screen);
      }
      slideAnim.setValue(16);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const navigateBack = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 16,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen('REMINDERS');
      setActiveTab('REMINDERS');
      slideAnim.setValue(-16);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  // Tab change handler from the Bottom Navigation Dock
  const handleTabChange = useCallback((tab: PrimaryTab) => {
    if (currentScreen === tab) return;
    navigateTo(tab);
  }, [currentScreen, navigateTo]);

  // Reload alarms from local database
  const reloadAlarms = useCallback(async () => {
    const list = await getAllAlarmsFromDb();
    setAlarms(list);
  }, []);

  // 1. Initial app load: SQLite Database, Storage, Auth, Notifications & Alarm System
  useEffect(() => {
    async function initializeApp() {
      try {
        await setupNotificationSystem();
        await setupAlarmSystem();
        await getDatabase(); // Ensure SQLite database and tables (reminders, alarms) exist

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

        // Load active reminders, alarms, & settings
        const [loadedReminders, loadedAlarms, loadedSettings] = await Promise.all([
          loadActiveRemindersFromDb(),
          getAllAlarmsFromDb(),
          loadSettingsFromStorage(),
        ]);
        setReminders(loadedReminders);
        setAlarms(loadedAlarms);
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

  // 2. Listen to Cloud Sync changes & refresh Reminders UI automatically
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

  // 4. Notification action listeners for Reminders (Finish, Postpone 15m, Postpone 1h)
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

  // 5. Alarm listeners & active ringing subscription
  useEffect(() => {
    const unsubRinging = subscribeToRingingAlarm((ringing) => {
      setActiveRingingAlarm(ringing);
    });

    const cleanupAlarmNotif = registerAlarmNotificationListeners(
      (alarm) => {
        setActiveRingingAlarm(alarm);
        reloadAlarms();
      },
      () => {
        reloadAlarms();
      }
    );

    return () => {
      unsubRinging();
      cleanupAlarmNotif();
    };
  }, [reloadAlarms]);

  // 6. Android Hardware Back Button Handler
  useEffect(() => {
    const onBackPress = () => {
      if (currentScreen === 'EDIT_REMINDER') {
        setEditingReminder(null);
        navigateBack();
        return true;
      }
      if (currentScreen === 'ADD_REMINDER') {
        navigateBack();
        return true;
      }
      if (currentScreen === 'ALARMS' || currentScreen === 'SETTINGS') {
        // Return to primary Reminders (Home) tab
        navigateTo('REMINDERS');
        return true;
      }
      return false; // On REMINDERS, exit app naturally
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => backHandler.remove();
  }, [currentScreen, navigateBack, navigateTo]);

  // ==========================================
  // HANDLERS FOR REMINDERS
  // ==========================================
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
    async (taskText: string, dueAt: number, repeat?: RepeatRule | null, voiceNoteUri?: string | null, isVoice?: boolean) => {
      const { updatedList } = await createReminder(taskText, dueAt, reminders, repeat, voiceNoteUri, isVoice);
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

  // ==========================================
  // HANDLERS FOR ALARMS (100% Local & Isolated)
  // ==========================================
  const handleAddAlarm = useCallback(
    async (alarmData: {
      time: string;
      targetTimestamp: number;
      label?: string;
      vibrate: boolean;
      soundUri?: string;
    }) => {
      const newAlarm: Alarm = {
        id: `alarm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        time: alarmData.time,
        targetTimestamp: alarmData.targetTimestamp,
        label: alarmData.label,
        enabled: true,
        soundUri: alarmData.soundUri || 'default',
        vibrate: alarmData.vibrate,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await upsertAlarmInDb(newAlarm);
      await scheduleAlarm(newAlarm);
      await reloadAlarms();
    },
    [reloadAlarms]
  );

  const handleUpdateAlarm = useCallback(
    async (id: string, updates: Partial<Alarm>) => {
      const existing = alarms.find((a) => a.id === id);
      if (!existing) return;

      const updated: Alarm = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
      };

      await upsertAlarmInDb(updated);
      if (updated.enabled) {
        await scheduleAlarm(updated);
      } else {
        await cancelAlarm(updated.notificationId);
      }
      await reloadAlarms();
    },
    [alarms, reloadAlarms]
  );

  const handleToggleAlarm = useCallback(
    async (id: string, enabled: boolean) => {
      const existing = alarms.find((a) => a.id === id);
      if (!existing) return;

      await setAlarmEnabledInDb(id, enabled);
      const updated = { ...existing, enabled };

      if (enabled) {
        await scheduleAlarm(updated);
      } else {
        await cancelAlarm(existing.notificationId);
      }
      await reloadAlarms();
    },
    [alarms, reloadAlarms]
  );

  const handleDeleteAlarm = useCallback(
    async (id: string) => {
      const existing = alarms.find((a) => a.id === id);
      if (existing?.notificationId) {
        await cancelAlarm(existing.notificationId);
      }
      await deleteAlarmFromDb(id);
      await reloadAlarms();
    },
    [alarms, reloadAlarms]
  );

  const handleDismissRingingAlarm = useCallback(async (alarmId: string) => {
    await dismissAlarm(alarmId);
    setActiveRingingAlarm(null);
    await reloadAlarms();
  }, [reloadAlarms]);

  const handleSnoozeRingingAlarm = useCallback(async (alarmId: string) => {
    await snoozeAlarm(alarmId, 10);
    setActiveRingingAlarm(null);
    await reloadAlarms();
  }, [reloadAlarms]);

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

  const isPrimaryScreen =
    currentScreen === 'REMINDERS' ||
    currentScreen === 'ALARMS' ||
    currentScreen === 'SETTINGS';

  return (
    <ErrorBoundary>
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
        {currentScreen === 'REMINDERS' && (
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

        {currentScreen === 'ALARMS' && (
          <AlarmsScreen
            alarms={alarms}
            onAddAlarm={handleAddAlarm}
            onUpdateAlarm={handleUpdateAlarm}
            onToggleAlarm={handleToggleAlarm}
            onDeleteAlarm={handleDeleteAlarm}
          />
        )}

        {currentScreen === 'SETTINGS' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBack={() => navigateTo('REMINDERS')}
            showBack={false}
            onRefreshReminders={() => {
              loadActiveRemindersFromDb().then(setReminders);
            }}
          />
        )}

        {currentScreen === 'ADD_REMINDER' && (
          <AddReminderScreen
            settings={settings}
            onBack={navigateBack}
            onSaveReminder={handleCreateReminder}
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

      {/* Bottom Navigation Dock: Always displayed on the 3 primary screens */}
      {isPrimaryScreen && (
        <BottomNavDock
          activeTab={activeTab}
          onSelectTab={handleTabChange}
        />
      )}

      {/* Fullscreen Alarm Ringing Modal */}
      <AlarmRingingModal
        alarm={activeRingingAlarm}
        onDismiss={handleDismissRingingAlarm}
        onSnooze={handleSnoozeRingingAlarm}
      />

      {/* Offline to Online Migration Confirmation Modal */}
      <OfflineMigrationModal
        visible={showOfflineModal}
        count={offlineCount}
        onConfirm={handleConfirmMigration}
        onCancel={handleCancelMigration}
      />
      </View>
    </ErrorBoundary>
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
