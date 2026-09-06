import { Reminder, ReminderSection } from '../types/reminder';
import { Colors } from '../constants/theme';
import {
  scheduleReminderNotification,
  cancelReminderNotification,
} from './notifications';
import { saveRemindersToStorage } from './storage';
import { recordUsedTime } from './suggestions';

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
 * Create a new reminder and schedule its notification
 */
export async function createReminder(
  task: string,
  dueAt: number,
  allReminders: Reminder[]
): Promise<{ updatedList: Reminder[]; newReminder: Reminder }> {
  const newReminder: Reminder = {
    id: `remind_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    task: task.trim(),
    dueAt,
    completed: false,
    createdAt: Date.now(),
  };

  // Schedule notification
  const notificationId = await scheduleReminderNotification(newReminder);
  newReminder.notificationId = notificationId;

  // Record time in intelligent learning history
  recordUsedTime(dueAt).catch(() => {});

  const updatedList = [newReminder, ...allReminders];
  await saveRemindersToStorage(updatedList);
  return { updatedList, newReminder };
}

/**
 * Toggle completion status
 */
export async function toggleReminderCompletion(
  id: string,
  allReminders: Reminder[]
): Promise<Reminder[]> {
  const updatedList = await Promise.all(
    allReminders.map(async (r) => {
      if (r.id === id) {
        const nextCompleted = !r.completed;
        if (nextCompleted) {
          // Completed: Cancel notification
          if (r.notificationId) {
            await cancelReminderNotification(r.notificationId);
          }
          return {
            ...r,
            completed: true,
            completedAt: Date.now(),
            notificationId: null,
          };
        } else {
          // Uncompleted: Reschedule if in future
          const notifId = await scheduleReminderNotification(r);
          return {
            ...r,
            completed: false,
            completedAt: null,
            notificationId: notifId,
          };
        }
      }
      return r;
    })
  );

  await saveRemindersToStorage(updatedList);
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
  const updatedList = await Promise.all(
    allReminders.map(async (r) => {
      if (r.id === id) {
        let newDueAt: number;
        if (isAbsoluteTimestamp) {
          newDueAt = minutesOrTimestamp;
        } else {
          // Add minutes to max(now, r.dueAt)
          const baseTime = Math.max(Date.now(), r.dueAt);
          newDueAt = baseTime + minutesOrTimestamp * 60 * 1000;
        }

        // Reschedule
        if (r.notificationId) {
          await cancelReminderNotification(r.notificationId);
        }

        const updatedReminder: Reminder = {
          ...r,
          dueAt: newDueAt,
          completed: false,
          completedAt: null,
        };

        const newNotifId = await scheduleReminderNotification(updatedReminder);
        updatedReminder.notificationId = newNotifId;

        return updatedReminder;
      }
      return r;
    })
  );

  await saveRemindersToStorage(updatedList);
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
  const updatedList = await Promise.all(
    allReminders.map(async (r) => {
      if (r.id === id) {
        const merged: Reminder = { ...r, ...updates };

        // If due date or completion changed, reschedule or cancel notification
        if (updates.dueAt !== undefined || updates.completed !== undefined) {
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

        return merged;
      }
      return r;
    })
  );

  await saveRemindersToStorage(updatedList);
  return updatedList;
}

/**
 * Delete a reminder
 */
export async function deleteReminder(
  id: string,
  allReminders: Reminder[]
): Promise<Reminder[]> {
  const target = allReminders.find((r) => r.id === id);
  if (target?.notificationId) {
    await cancelReminderNotification(target.notificationId);
  }

  const updatedList = allReminders.filter((r) => r.id !== id);
  await saveRemindersToStorage(updatedList);
  return updatedList;
}

/**
 * Clear all completed reminders
 */
export async function clearCompletedReminders(allReminders: Reminder[]): Promise<Reminder[]> {
  const updatedList = allReminders.filter((r) => !r.completed);
  await saveRemindersToStorage(updatedList);
  return updatedList;
}
