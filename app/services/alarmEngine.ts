import { Linking, NativeModules, Platform, Vibration } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
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


import { Alarm } from '../types/alarm';
import {
  getAlarmByIdFromDb,
  upsertAlarmInDb,
  deleteAlarmFromDb,
  setAlarmEnabledInDb,
} from '../database/alarmDao';
import { reportCrash } from './crashReporter';

export const ALARM_CHANNEL_ID = 'remind_alarms_channel_v1';
export const ALARM_CATEGORY_ID = 'REMIND_ALARM_ACTION_CATEGORY';

export const ALARM_ACTION_IDENTIFIERS = {
  DISMISS: 'ALARM_ACTION_DISMISS',
  SNOOZE: 'ALARM_ACTION_SNOOZE_10',
};

let hasAlarmChannelSupport = false;

// Global audio playback and vibration state for active ringing alarms
let vibrationInterval: any = null;
let chimeInterval: any = null;
let activeRingingAlarm: Alarm | null = null;
type RingingListener = (alarm: Alarm | null) => void;
const ringingListeners: Set<RingingListener> = new Set();

export function subscribeToRingingAlarm(listener: RingingListener): () => void {
  ringingListeners.add(listener);
  listener(activeRingingAlarm);
  return () => {
    ringingListeners.delete(listener);
  };
}

function notifyRingingState(alarm: Alarm | null) {
  activeRingingAlarm = alarm;
  ringingListeners.forEach((fn) => {
    try {
      fn(alarm);
    } catch (e) {
      console.warn('Ringing listener error:', e);
    }
  });
}

/**
 * Configure dedicated high-priority Alarm notification channel and actions
 */
export async function setupAlarmSystem(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      await setNotificationChannelAsync(ALARM_CHANNEL_ID, {
        name: 'Alarms',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 1000],
        lightColor: '#4FC3F7',
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      hasAlarmChannelSupport = true;
    } catch {
      // In Expo Go on Android, NotificationsChannelsProvider is not initialized
      hasAlarmChannelSupport = false;
    }

    try {
      await setNotificationCategoryAsync(ALARM_CATEGORY_ID, [
        {
          identifier: ALARM_ACTION_IDENTIFIERS.DISMISS,
          buttonTitle: 'Dismiss',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: ALARM_ACTION_IDENTIFIERS.SNOOZE,
          buttonTitle: 'Snooze (10m)',
          options: {
            opensAppToForeground: false,
          },
        },
      ]);
    } catch (err) {
      console.warn('Failed to set alarm category:', err);
    }
  }

  // Request notification permissions
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
 * Calculate the next Date trigger for an alarm based on time "HH:mm"
 * If target time has passed today, it rings tomorrow
 */
export function calculateNextAlarmDate(timeStr: string): Date {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;

  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/**
 * Get human-readable live remaining time until an alarm rings
 */
export function getRemainingTimeText(targetTimestamp: number): string {
  const diffMs = targetTimestamp - Date.now();
  if (diffMs <= 0) {
    return 'ringing now';
  }

  const totalMinutes = Math.round(diffMs / (1000 * 60));
  if (totalMinutes < 1) {
    return 'in less than a minute';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  if (minutes === 0) {
    return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  return `in ${hours}h ${minutes}m`;
}

/**
 * Schedule an exact native alarm notification using expo-notifications
 */
export async function scheduleAlarm(alarm: Alarm): Promise<string | null> {
  try {
    if (!alarm.enabled) {
      if (alarm.notificationId) {
        await cancelAlarm(alarm.notificationId);
      }
      return null;
    }

    if (alarm.notificationId) {
      await cancelAlarm(alarm.notificationId);
    }

    // Use stored targetTimestamp or recalculate if in the past
    let targetDate = new Date(alarm.targetTimestamp);
    if (targetDate.getTime() <= Date.now()) {
      targetDate = calculateNextAlarmDate(alarm.time);
    }

    const notificationData: Record<string, any> = {
      isAlarm: true,
      alarmId: alarm.id,
      time: alarm.time,
      targetTimestamp: targetDate.getTime(),
      label: alarm.label || 'Alarm',
      vibrate: alarm.vibrate,
    };

    const notificationId = await scheduleNotificationAsync({
      content: {
        title: alarm.label?.trim() ? `⏰ Alarm: ${alarm.label}` : '⏰ Alarm',
        body: `It's ${formatAlarmTimeString(alarm.time)}`,
        sound: 'default',
        categoryIdentifier: ALARM_CATEGORY_ID,
        color: '#0078B7',
        priority: AndroidNotificationPriority.MAX,
        vibrate: alarm.vibrate ? [0, 500, 200, 500, 200, 1000] : undefined,
        autoDismiss: false,
        sticky: true,
        data: notificationData,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: targetDate,
        ...(hasAlarmChannelSupport ? { channelId: ALARM_CHANNEL_ID } : {}),
      },
    });

    // Save updated notificationId and targetTimestamp into local SQLite
    await upsertAlarmInDb({
      ...alarm,
      targetTimestamp: targetDate.getTime(),
      notificationId,
      updatedAt: Date.now(),
    });

    // Push directly to Android OS System Clock so it rings when locked / sleeping
    await pushAlarmToAndroidSystem(alarm.time, alarm.label, alarm.vibrate);

    return notificationId;
  } catch (err) {
    console.warn('scheduleAlarm error:', err);
    reportCrash(err, { feature: 'alarm-engine', action: 'scheduleAlarm', alarmId: alarm.id, time: alarm.time });
    return null;
  }
}

/**
 * Push alarm directly to Android OS System Clock app using Android's standard SET_ALARM intent
 */
export async function pushAlarmToAndroidSystem(
  time: string,
  label?: string,
  vibrate: boolean = true
): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Expo Go client lacks com.android.alarm.permission.SET_ALARM; skip to avoid SecurityException
  if (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants as any).appOwnership === 'expo'
  ) {
    return;
  }
  try {
    const [hStr, mStr] = time.split(':');
    const hour = parseInt(hStr, 10);
    const minute = parseInt(mStr, 10);
    if (isNaN(hour) || isNaN(minute)) return;

    const safeLabel = (label || 'Alarm').replace(/[;=#]/g, ' ');

    // React Native's Linking.sendIntent has a known bug (https://github.com/react/react-native/issues/4141)
    // where JS numbers are stored into the bundle as Double instead of Integer.
    // The Android System Clock app specifically calls getIntExtra("android.intent.extra.alarm.HOUR", -1).
    // Because Double cannot be cast to Integer, getIntExtra() returns -1, causing the Clock app to
    // default to the CURRENT TIME (resulting in an alarm set for 24 hours later).
    // Using Android's URI_INTENT_SCHEME syntax with `i.` strictly enforces Integer type serialization.
    const intentUrl = `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minute};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(safeLabel)};B.android.intent.extra.alarm.VIBRATE=${vibrate};B.android.intent.extra.alarm.SKIP_UI=true;end`;

    try {
      await Linking.openURL(intentUrl);
      return;
    } catch {
      // If openURL intent scheme is blocked on a particular ROM, fall back to sendIntent
    }

    if (typeof Linking.sendIntent === 'function') {
      await Linking.sendIntent('android.intent.action.SET_ALARM', [
        { key: 'android.intent.extra.alarm.HOUR', value: hour },
        { key: 'android.intent.extra.alarm.MINUTES', value: minute },
        { key: 'android.intent.extra.alarm.MESSAGE', value: safeLabel },
        { key: 'android.intent.extra.alarm.VIBRATE', value: vibrate },
        { key: 'android.intent.extra.alarm.SKIP_UI', value: true },
      ]);
    }
  } catch (err) {
    // If the system clock app does not support the intent or permission is missing, fail gracefully
    console.warn('Could not sync alarm to Android system clock:', err);
  }
}

/**
 * Cancel a scheduled alarm notification
 */
export async function cancelAlarm(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.warn('cancelAlarm error:', e);
  }
}

/**
 * Trigger immediate native system sound notification
 */
async function triggerSystemAlarmChime(alarm: Alarm): Promise<void> {
  try {
    await scheduleNotificationAsync({
      content: {
        title: alarm.label?.trim() ? `⏰ Alarm: ${alarm.label}` : '⏰ Alarm',
        body: `It's ${formatAlarmTimeString(alarm.time)}`,
        sound: 'default', // Uses Android native system alarm/notification sound!
        priority: AndroidNotificationPriority.MAX,
      },
      trigger: null, // null trigger = immediate execution and native system audio chime!
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Start the ringing audio and vibration loop for an active alarm
 */
export async function startAlarmRinging(alarm: Alarm): Promise<void> {
  try {
    notifyRingingState(alarm);

    // Continuous rhythmic alarm vibration if enabled: pulse pattern
    if (alarm.vibrate) {
      try {
        Vibration.vibrate([0, 600, 250, 600, 250, 900], true);
      } catch (ve) {
        console.warn('Vibration error:', ve);
      }
    }

    // Play native system sound chime repeatedly while alarm is ringing
    await triggerSystemAlarmChime(alarm);

    if (chimeInterval) clearInterval(chimeInterval);
    chimeInterval = setInterval(() => {
      if (activeRingingAlarm) {
        triggerSystemAlarmChime(alarm);
      }
    }, 4500);
  } catch (err) {
    console.warn('startAlarmRinging error:', err);
  }
}

/**
 * Stop active ringing sound and vibration
 */
export async function stopAlarmRinging(): Promise<void> {
  try {
    Vibration.cancel();
    if (vibrationInterval) {
      clearInterval(vibrationInterval);
      vibrationInterval = null;
    }

    if (chimeInterval) {
      clearInterval(chimeInterval);
      chimeInterval = null;
    }

    notifyRingingState(null);
  } catch (e) {
    console.warn('stopAlarmRinging error:', e);
  }
}

/**
 * Dismiss an alarm:
 * Since all alarms are one-time alarms, dismiss removes it completely from the database!
 */
export async function dismissAlarm(alarmId: string): Promise<void> {
  try {
    await stopAlarmRinging();

    const alarm = await getAlarmByIdFromDb(alarmId);
    if (!alarm) return;

    if (alarm.notificationId) {
      await cancelAlarm(alarm.notificationId);
    }
    await deleteAlarmFromDb(alarmId);
  } catch (err) {
    console.warn('dismissAlarm error:', err);
  }
}

/**
 * Snooze an alarm (+10 minutes by default)
 * Advances the alarm's time string by snoozeMinutes and saves to DB so the UI displays the updated time
 */
export async function snoozeAlarm(alarmId: string, snoozeMinutes: number = 10): Promise<void> {
  try {
    await stopAlarmRinging();

    const alarm = await getAlarmByIdFromDb(alarmId);
    if (!alarm) return;

    const snoozeDate = new Date(Date.now() + snoozeMinutes * 60 * 1000);

    // Compute new HH:mm time string so the alarm's display time updates to time + 10 min
    const newH = snoozeDate.getHours();
    const newM = snoozeDate.getMinutes();
    const newHStr = newH < 10 ? `0${newH}` : `${newH}`;
    const newMStr = newM < 10 ? `0${newM}` : `${newM}`;
    const newTime = `${newHStr}:${newMStr}`;

    const notificationData: Record<string, any> = {
      isAlarm: true,
      alarmId: alarm.id,
      time: newTime,
      targetTimestamp: snoozeDate.getTime(),
      label: alarm.label || 'Alarm',
      vibrate: alarm.vibrate,
    };

    const notificationId = await scheduleNotificationAsync({
      content: {
        title: alarm.label?.trim() ? `⏰ Alarm: ${alarm.label}` : '⏰ Alarm',
        body: `It's ${formatAlarmTimeString(newTime)}`,
        sound: 'default',
        categoryIdentifier: ALARM_CATEGORY_ID,
        color: '#0078B7',
        priority: AndroidNotificationPriority.MAX,
        vibrate: alarm.vibrate ? [0, 500, 200, 500, 200, 1000] : undefined,
        autoDismiss: false,
        sticky: true,
        data: notificationData,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: snoozeDate,
        ...(hasAlarmChannelSupport ? { channelId: ALARM_CHANNEL_ID } : {}),
      },
    });

    await upsertAlarmInDb({
      ...alarm,
      time: newTime,
      targetTimestamp: snoozeDate.getTime(),
      notificationId,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to schedule snooze notification:', err);
  }
}

/**
 * Register background & foreground alarm notification handlers
 */
export function registerAlarmNotificationListeners(
  onAlarmTriggered: (alarm: Alarm) => void,
  onAlarmsChanged?: () => void
) {
  // 1. Foreground / Background notification arrival
  const receivedSub = addNotificationReceivedListener(async (notification) => {
    try {
      const data = notification.request.content.data as Record<string, any> | undefined;
      const alarmId = typeof data?.alarmId === 'string' ? data.alarmId : null;
      if (data?.isAlarm && alarmId) {
        const alarm = await getAlarmByIdFromDb(alarmId);
        if (alarm) {
          startAlarmRinging(alarm);
          onAlarmTriggered(alarm);
        }
      }
    } catch (e) {
      console.warn('Error in alarm received listener:', e);
    }
  });

  // 2. Action responses ('Dismiss' or 'Snooze')
  const responseSub = addNotificationResponseReceivedListener(async (response) => {
    try {
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      const alarmId = typeof data?.alarmId === 'string' ? data.alarmId : null;
      if (data?.isAlarm && alarmId) {
        const actionId = response.actionIdentifier;

        try {
          await dismissNotificationAsync(response.notification.request.identifier);
        } catch (e) {
          // ignore
        }

        if (actionId === ALARM_ACTION_IDENTIFIERS.DISMISS) {
          await dismissAlarm(alarmId);
          onAlarmsChanged?.();
        } else if (actionId === ALARM_ACTION_IDENTIFIERS.SNOOZE) {
          await snoozeAlarm(alarmId, 10);
          onAlarmsChanged?.();
        } else {
          const alarm = await getAlarmByIdFromDb(alarmId);
          if (alarm) {
            startAlarmRinging(alarm);
            onAlarmTriggered(alarm);
          }
        }
      }
    } catch (e) {
      console.warn('Error in alarm response listener:', e);
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

/**
 * Helper to format "07:00" to "7:00 AM" / "10:30 PM"
 */
export function formatAlarmTimeString(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let hour = parseInt(hStr, 10) || 0;
  const minute = parseInt(mStr, 10) || 0;
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const minutePadded = minute < 10 ? `0${minute}` : `${minute}`;
  return `${hour}:${minutePadded} ${period}`;
}
