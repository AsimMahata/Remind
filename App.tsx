import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  BackHandler,
  View,
  Animated,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { Reminder, AppSettings, DEFAULT_SETTINGS } from './types/reminder';
import { Colors } from './constants/theme';
import {
  loadRemindersFromStorage,
  saveRemindersToStorage,
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
  clearCompletedReminders,
  updateReminder,
} from './services/reminders';

import { HomeScreen } from './screens/HomeScreen';
import { AddReminderScreen } from './screens/AddReminderScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { EditReminderScreen } from './screens/EditReminderScreen';

type ScreenType = 'HOME' | 'ADD_REMINDER' | 'SETTINGS' | 'EDIT_REMINDER';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('HOME');
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);

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

  // 1. Initial app load: Storage & Notification Channels
  useEffect(() => {
    async function initializeApp() {
      try {
        await setupNotificationSystem();
        const [loadedReminders, loadedSettings] = await Promise.all([
          loadRemindersFromStorage(),
          loadSettingsFromStorage(),
        ]);
        setReminders(loadedReminders);
        setSettings(loadedSettings);
      } catch (err) {
        console.error('Error during App initialization:', err);
      } finally {
        setIsReady(true);
      }
    }

    initializeApp();
  }, []);

  // 2. Notification action listeners (Finish, Postpone 15m, Postpone 1h)
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

  // 3. Android Hardware Back Button Handler
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
    async (taskText: string, dueAt: number) => {
      const { updatedList } = await createReminder(taskText, dueAt, reminders);
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
            onBack={navigateBack}
            onSaveReminder={handleCreateReminder}
          />
        )}

        {currentScreen === 'SETTINGS' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBack={navigateBack}
          />
        )}

        {currentScreen === 'EDIT_REMINDER' && editingReminder && (
          <EditReminderScreen
            key={editingReminder.id}
            reminder={editingReminder}
            onBack={handleBackFromEdit}
            onUpdateReminder={handleUpdateReminder}
            onDeleteReminder={handleDeleteReminder}
          />
        )}
      </Animated.View>
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
