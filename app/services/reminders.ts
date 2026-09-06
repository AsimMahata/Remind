import { Reminder, ReminderSection, RepeatRule } from '../types/reminder';
import { Colors } from '../constants/theme';
import {
  scheduleReminderNotification,
  cancelReminderNotification,
} from './notifications';
import { calculateNextOccurrence } from './recurrence';
import { recordUsedTime } from './suggestions';
import {
  getActiveReminders,
  upsertReminder,
  softDeleteReminder,
  softDeleteMultipleReminders,
  getDeletedReminders,
  restoreReminderInDb,
  purgeDeletedRemindersFromDb,
  getReminderStats,
} from '../database/reminderDao';
import { triggerSync } from './sync';
import { getAuthState } from './auth';
import { apiRequest } from './api';

/**
 * Format timestamp into Android style date string matching screenshot:
 * "Today, 7:00 PM", "Tomorrow, 8:00 AM", or "Thu, May 28, 2026, 6:00 AM"
 */
export function formatReminderDateTime(timestamp: number): {
  formattedText: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
} {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const isOverdue = timestamp < now.getTime();

  // Robust local time formatting
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? `0${minutes}` : String(minutes);
  const timeStr = `${hours}:${minStr} ${ampm}`;

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let formattedText = '';
  if (isToday) {
    formattedText = `Today, ${timeStr}`;
  } else if (isTomorrow) {
    formattedText = `Tomorrow, ${timeStr}`;
  } else {
    const weekday = DAY_NAMES[date.getDay()];
    const month = MONTH_NAMES[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    formattedText = `${weekday}, ${month} ${day}, ${year}, ${timeStr}`;
  }

  return {
    formattedText,
    isOverdue,
    isToday,
    isTomorrow,
  };
}

/**
 * Categorize reminders into Sections: Overdue, Today, Upcoming, Completed
 */
export function organizeRemindersIntoSections(reminders: Reminder[]): ReminderSection[] {
  const now = Date.now();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const overdueList: Reminder[] = [];
  const todayList: Reminder[] = [];
  const upcomingList: Reminder[] = [];
  const completedList: Reminder[] = [];

  // Sort by due date ascending
  const sorted = [...reminders].sort((a, b) => a.dueAt - b.dueAt);

  for (const reminder of sorted) {
    if (reminder.deleted) {
      continue;
    }

    if (reminder.completed) {
      completedList.push(reminder);
      continue;
    }

    if (reminder.dueAt < now) {
      overdueList.push(reminder);
    } else if (reminder.dueAt <= todayEnd.getTime()) {
      todayList.push(reminder);
    } else {
      upcomingList.push(reminder);
    }
  }

  const sections: ReminderSection[] = [];

  if (overdueList.length > 0) {
    sections.push({
      title: 'Overdue',
      type: 'OVERDUE',
      color: Colors.accentOverdue,
      data: overdueList,
    });
  }

  if (todayList.length > 0) {
    sections.push({
      title: 'Today',
      type: 'TODAY',
      color: Colors.accentCyan,
      data: todayList,
    });
  }

  if (upcomingList.length > 0) {
    sections.push({
      title: 'Upcoming',
      type: 'UPCOMING',
      color: Colors.accentCyan,
      data: upcomingList,
    });
  }

  if (completedList.length > 0) {
    sections.push({
      title: 'Completed',
      type: 'COMPLETED',
      color: Colors.accentCompleted,
      data: completedList,
    });
  }

  return sections;
}

/**
 * Load reminders from local SQLite database for active session
 */
export async function loadActiveRemindersFromDb(): Promise<Reminder[]> {
  const authState = getAuthState();
  return await getActiveReminders(authState.user?.id);
}

/**
 * Create a new reminder, store in SQLite, schedule local notification, and enqueue sync
 */
export async function createReminder(
  task: string,
  dueAt: number,
  allReminders: Reminder[],
  repeat?: RepeatRule | null
): Promise<{ updatedList: Reminder[]; newReminder: Reminder }> {
  const authState = getAuthState();
  const now = Date.now();

  const newReminder: Reminder = {
    id: `remind_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: authState.user?.id || null,
    task: task.trim(),
    dueAt,
    completed: false,
    completedAt: null,
    deleted: false,
    deletedAt: null,
    repeat: repeat || null,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    version: 1,
  };

  // Schedule local notification on Android device
  const notificationId = await scheduleReminderNotification(newReminder);
  newReminder.notificationId = notificationId;

  // Record time in intelligent learning suggestions
  recordUsedTime(dueAt).catch(() => {});

  // Save to SQLite and enqueue in sync queue
  await upsertReminder(newReminder, true);

  // Trigger background cloud sync if authenticated and online
  triggerSync();

  const updatedList = [newReminder, ...allReminders.filter((r) => r.id !== newReminder.id)];
  return { updatedList, newReminder };
}

/**
 * Toggle completion status.
 * If the reminder has a repeat rule and is being marked complete,
 * this calculates the next occurrence, advances the reminder, archives a completed
 * instance for history, and reschedules the notification.
 */
export async function toggleReminderCompletion(
  id: string,
  allReminders: Reminder[]
): Promise<Reminder[]> {
  const now = Date.now();
  const target = allReminders.find((r) => r.id === id);

  if (!target) return allReminders;

  // 1. Handling recurring reminder completion: advance to next occurrence
  if (!target.completed && target.repeat && target.repeat.frequency !== 'none') {
    const nextDueAt = calculateNextOccurrence(target.dueAt, target.repeat);

    if (nextDueAt !== null) {
      // Cancel old notification
      if (target.notificationId) {
        await cancelReminderNotification(target.notificationId);
      }

      // Create an archived completed entry for task history
      const completedRecord: Reminder = {
        id: `remind_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: target.userId || null,
        task: target.task,
        dueAt: target.dueAt,
        completed: true,
        completedAt: now,
        deleted: false,
        deletedAt: null,
        createdAt: target.createdAt,
        updatedAt: now,
        notes: target.notes || '',
        notificationId: null,
        repeat: null, // Archived entry does not repeat
        version: 1,
        syncStatus: 'pending',
      };

      // Advance the recurring task's due date to the next occurrence
      const updatedRecurring: Reminder = {
        ...target,
        dueAt: nextDueAt,
        completed: false,
        completedAt: null,
        updatedAt: now,
        version: (target.version || 1) + 1,
        syncStatus: 'pending',
      };

      // Reschedule future notification
      const newNotifId = await scheduleReminderNotification(updatedRecurring);
      updatedRecurring.notificationId = newNotifId;

      // Save both to local SQLite & trigger sync
      await upsertReminder(completedRecord, true);
      await upsertReminder(updatedRecurring, true);
      triggerSync();

      return [
        completedRecord,
        ...allReminders.map((r) => (r.id === id ? updatedRecurring : r)),
      ];
    }
  }

  // 2. Standard single occurrence toggle
  let updatedItem: Reminder | null = null;

  const updatedList = await Promise.all(
    allReminders.map(async (r) => {
      if (r.id === id) {
        const nextCompleted = !r.completed;
        if (nextCompleted) {
          if (r.notificationId) {
            await cancelReminderNotification(r.notificationId);
          }
          updatedItem = {
            ...r,
            completed: true,
            completedAt: now,
            updatedAt: now,
            notificationId: null,
            syncStatus: 'pending',
            version: (r.version || 1) + 1,
          };
        } else {
          const notifId = await scheduleReminderNotification(r);
          updatedItem = {
            ...r,
            completed: false,
            completedAt: null,
            updatedAt: now,
            notificationId: notifId,
            syncStatus: 'pending',
            version: (r.version || 1) + 1,
          };
        }
        return updatedItem;
      }
      return r;
    })
  );

  if (updatedItem) {
    await upsertReminder(updatedItem, true);
    triggerSync();
  }

  return updatedList;
}

/**
 * Postpone a reminder by minutes or specific new timestamp
 */
export async function postponeReminder(
  id: string,
  minutesOrTimestamp: number,
  isAbsoluteTimestamp: boolean,
  allReminders: Reminder[]
): Promise<Reminder[]> {
  const now = Date.now();
  let updatedItem: Reminder | null = null;

  const updatedList = await Promise.all(
    allReminders.map(async (r) => {
      if (r.id === id) {
        let newDueAt: number;
        if (isAbsoluteTimestamp) {
          newDueAt = minutesOrTimestamp;
        } else {
          const baseTime = Math.max(Date.now(), r.dueAt);
          newDueAt = baseTime + minutesOrTimestamp * 60 * 1000;
        }

        if (r.notificationId) {
          await cancelReminderNotification(r.notificationId);
        }

        const updatedReminder: Reminder = {
          ...r,
          dueAt: newDueAt,
          completed: false,
          completedAt: null,
          updatedAt: now,
          syncStatus: 'pending',
          version: (r.version || 1) + 1,
        };

        const newNotifId = await scheduleReminderNotification(updatedReminder);
        updatedReminder.notificationId = newNotifId;
        updatedItem = updatedReminder;

        return updatedReminder;
      }
      return r;
    })
  );

  if (updatedItem) {
    await upsertReminder(updatedItem, true);
    triggerSync();
  }

  return updatedList;
}

/**
 * Update an existing reminder's fields (task text, dueAt, completion)
 */
export async function updateReminder(
  id: string,
  updates: Partial<Reminder>,
  allReminders: Reminder[]
): Promise<Reminder[]> {
  const now = Date.now();
  let updatedItem: Reminder | null = null;

  const updatedList = await Promise.all(
    allReminders.map(async (r) => {
      if (r.id === id) {
        const merged: Reminder = {
          ...r,
          ...updates,
          updatedAt: now,
          syncStatus: 'pending',
          version: (r.version || 1) + 1,
        };

        if (
          updates.dueAt !== undefined ||
          updates.completed !== undefined ||
          updates.repeat !== undefined
        ) {
          if (r.notificationId) {
            await cancelReminderNotification(r.notificationId);
            merged.notificationId = null;
          }

          if (!merged.completed && merged.dueAt > Date.now()) {
            const newNotifId = await scheduleReminderNotification(merged);
            merged.notificationId = newNotifId;
          }

          if (updates.dueAt !== undefined) {
            recordUsedTime(updates.dueAt).catch(() => {});
          }
        }

        updatedItem = merged;
        return merged;
      }
      return r;
    })
  );

  if (updatedItem) {
    await upsertReminder(updatedItem, true);
    triggerSync();
  }

  return updatedList;
}

/**
 * Soft delete a reminder locally in SQLite and enqueue cloud sync
 */
export async function deleteReminder(
  id: string,
  allReminders: Reminder[]
): Promise<Reminder[]> {
  const target = allReminders.find((r) => r.id === id);
  if (target?.notificationId) {
    await cancelReminderNotification(target.notificationId);
  }

  await softDeleteReminder(id, true);
  triggerSync();

  return allReminders.filter((r) => r.id !== id);
}

/**
 * Clear all completed reminders
 */
export async function clearCompletedReminders(allReminders: Reminder[]): Promise<Reminder[]> {
  const toDelete = allReminders.filter((r) => r.completed);

  for (const r of toDelete) {
    if (r.notificationId) {
      await cancelReminderNotification(r.notificationId);
    }
    await softDeleteReminder(r.id, true);
  }

  triggerSync();
  return allReminders.filter((r) => !r.completed);
}

/**
 * Soft delete multiple reminders at once (batch delete)
 */
export async function deleteMultipleReminders(
  ids: string[],
  allReminders: Reminder[]
): Promise<Reminder[]> {
  if (!ids || ids.length === 0) return allReminders;

  const idSet = new Set(ids);
  const toDelete = allReminders.filter((r) => idSet.has(r.id));

  for (const r of toDelete) {
    if (r.notificationId) {
      await cancelReminderNotification(r.notificationId);
    }
  }

  await softDeleteMultipleReminders(ids, true);
  triggerSync();

  return allReminders.filter((r) => !idSet.has(r.id));
}

/**
 * Soft delete all overdue reminders
 */
export async function deleteOverdueReminders(allReminders: Reminder[]): Promise<Reminder[]> {
  const now = Date.now();
  const overdueItems = allReminders.filter((r) => !r.completed && r.dueAt < now);
  const ids = overdueItems.map((r) => r.id);

  if (ids.length === 0) return allReminders;

  for (const r of overdueItems) {
    if (r.notificationId) {
      await cancelReminderNotification(r.notificationId);
    }
  }

  await softDeleteMultipleReminders(ids, true);
  triggerSync();

  const idSet = new Set(ids);
  return allReminders.filter((r) => !idSet.has(r.id));
}

/**
 * Fetch all soft-deleted reminders (Trash)
 */
export async function fetchDeletedReminders(): Promise<Reminder[]> {
  const authState = getAuthState();
  return await getDeletedReminders(authState.user?.id);
}

/**
 * Restore a soft-deleted reminder, reschedule notification, and sync
 */
export async function restoreDeletedReminder(id: string): Promise<Reminder | null> {
  const restored = await restoreReminderInDb(id);
  if (restored) {
    if (!restored.completed && restored.dueAt > Date.now()) {
      const notifId = await scheduleReminderNotification(restored);
      restored.notificationId = notifId;
      await upsertReminder(restored, false);
    }
    triggerSync();
  }
  return restored;
}

/**
 * Permanently purge all soft-deleted reminders from local SQLite and cloud backend
 */
export async function permanentlyPurgeDeletedReminders(): Promise<number> {
  const authState = getAuthState();

  // 1. Purge locally from SQLite
  const localPurged = await purgeDeletedRemindersFromDb(authState.user?.id);

  // 2. If authenticated, purge on backend
  if (authState.isAuthenticated) {
    try {
      await apiRequest('/reminders/purge-deleted', { method: 'POST' });
    } catch (e) {
      console.log('[Reminders] Failed to purge cloud trash (offline, will sync later):', e);
    }
  }

  triggerSync();
  return localPurged;
}

/**
 * Get reminder statistics (active, completed, deleted, total)
 */
export async function fetchReminderStats(): Promise<{
  active: number;
  completed: number;
  deleted: number;
  total: number;
}> {
  const authState = getAuthState();
  return await getReminderStats(authState.user?.id);
}

