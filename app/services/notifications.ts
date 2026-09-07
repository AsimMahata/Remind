import { Platform } from 'react-native';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { setNotificationCategoryAsync } from 'expo-notifications/build/setNotificationCategoryAsync';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { dismissNotificationAsync } from 'expo-notifications/build/dismissNotificationAsync';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from 'expo-notifications/build/NotificationsEmitter';
import {
  AndroidImportance,
  AndroidNotificationVisibility,
} from 'expo-notifications/build/NotificationChannelManager.types';
import {
  AndroidNotificationPriority,
  SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types';


import { Reminder } from '../types/reminder';
import { loadSettingsFromStorage } from './storage';
import { speakReminderText } from './textToSpeech';

export const ANDROID_CHANNEL_ID = 'remind_alerts_v1';
export const REMINDER_CATEGORY_ID = 'REMINDER_ACTION_CATEGORY';

export const ACTION_IDENTIFIERS = {
  FINISH: 'ACTION_FINISH',
  POSTPONE_15: 'ACTION_POSTPONE_15',
  POSTPONE_60: 'ACTION_POSTPONE_60',
};

// Configure foreground notification behavior safely
try {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.warn('setNotificationHandler not supported in current environment:', e);
}

let hasChannelSupport = false;

/**
 * Configure Android Notification Channel and Action Categories
 */
export async function setupNotificationSystem(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // 1. Channel setup (may not be supported in Expo Go)
    try {
      await setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Task Reminders',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0078B7',
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      hasChannelSupport = true;
    } catch {
      // Expo Go Android client doesn't initialize NotificationsChannelsProvider
      hasChannelSupport = false;
    }

    // 2. Action Category setup (Professional text, no emojis)
    try {
      await setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
        {
          identifier: ACTION_IDENTIFIERS.FINISH,
          buttonTitle: 'Done',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: ACTION_IDENTIFIERS.POSTPONE_15,
          buttonTitle: '+15 Min',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: ACTION_IDENTIFIERS.POSTPONE_60,
          buttonTitle: '+1 Hour',
          options: {
            opensAppToForeground: false,
          },
        },
      ]);
    } catch {
      // Ignored if categories are restricted in current environment
    }
  }

  // 3. Request permissions cleanly
  try {
    const { status: existingStatus } = await getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedule a local reminder notification
 */
export async function scheduleReminderNotification(reminder: Reminder): Promise<string | null> {
  try {
    const triggerDate = new Date(reminder.dueAt);
    const now = new Date();

    // If already overdue by more than 5 minutes, do not schedule past notification
    if (triggerDate.getTime() <= now.getTime()) {
      return null;
    }

    // If an existing notification was scheduled, cancel it first
    if (reminder.notificationId) {
      await cancelReminderNotification(reminder.notificationId);
    }

    const notificationData: Record<string, any> = {
      reminderId: reminder.id,
      task: reminder.task,
      dueAt: reminder.dueAt,
    };

    if (reminder.repeat) {
      notificationData.repeat = JSON.stringify(reminder.repeat);
    }

    let triggerInput: any;
    if (reminder.repeat?.frequency === 'daily') {
      triggerInput = {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: triggerDate.getHours(),
        minute: triggerDate.getMinutes(),
        ...(hasChannelSupport ? { channelId: ANDROID_CHANNEL_ID } : {}),
      };
    } else if (reminder.repeat?.frequency === 'weekly') {
      triggerInput = {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: triggerDate.getDay() + 1, // Expo uses 1 for Sunday, 7 for Saturday
        hour: triggerDate.getHours(),
        minute: triggerDate.getMinutes(),
        ...(hasChannelSupport ? { channelId: ANDROID_CHANNEL_ID } : {}),
      };
    } else {
      triggerInput = {
        type: SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        ...(hasChannelSupport ? { channelId: ANDROID_CHANNEL_ID } : {}),
      };
    }

    const notificationId = await scheduleNotificationAsync({
      content: {
        title: 'Remind',
        body: reminder.task,
        sound: 'default',
        categoryIdentifier: REMINDER_CATEGORY_ID,
        color: '#0078B7',
        priority: AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        autoDismiss: true,
        data: notificationData,
      },
      trigger: triggerInput,
    });

    return notificationId;
  } catch (error) {
    console.warn('scheduleReminderNotification failed (e.g. web or permission):', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelReminderNotification(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('cancelReminderNotification error:', error);
  }
}

/**
 * Sets up foreground and background notification response listeners
 */
export function registerNotificationListeners(
  onFinishTask: (reminderId: string) => void,
  onPostponeTask: (reminderId: string, minutes: number) => void
) {
  // 1. Notification received listener - speaks reminder aloud if voice is enabled
  const receivedSubscription = addNotificationReceivedListener(async (notification) => {
    try {
      const settings = await loadSettingsFromStorage();
      if (settings.voiceReminderEnabled) {
        const task =
          notification.request.content.body ||
          (notification.request.content.data?.task as string) ||
          notification.request.content.title;
        if (task) {
          await speakReminderText(task);
        }
      }
    } catch (err) {
      console.warn('Voice reminder on receive error:', err);
    }
  });

  // 2. When the user interacts with the notification or taps an action button
  const responseSubscription = addNotificationResponseReceivedListener(async (response) => {
    const actionId = response.actionIdentifier;
    const notificationId = response.notification.request.identifier;
    const reminderId = response.notification.request.content.data?.reminderId;

    // Immediately dismiss notification from tray so it disappears right away!
    try {
      await dismissNotificationAsync(notificationId);
    } catch (e) {
      console.warn('Failed to dismiss notification:', e);
    }

    if (typeof reminderId !== 'string' || !reminderId) return;

    if (actionId === ACTION_IDENTIFIERS.FINISH) {
      onFinishTask(reminderId);
    } else if (actionId === ACTION_IDENTIFIERS.POSTPONE_15) {
      onPostponeTask(reminderId, 15);
    } else if (actionId === ACTION_IDENTIFIERS.POSTPONE_60) {
      onPostponeTask(reminderId, 60);
    } else {
      // User tapped the notification banner itself to open the app: speak task
      try {
        const settings = await loadSettingsFromStorage();
        if (settings.voiceReminderEnabled) {
          const task =
            response.notification.request.content.body ||
            (response.notification.request.content.data?.task as string);
          if (task) {
            await speakReminderText(task);
          }
        }
      } catch (err) {
        console.warn('Voice reminder on open error:', err);
      }
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
