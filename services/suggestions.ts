import AsyncStorage from '@react-native-async-storage/async-storage';
import { Reminder } from '../types/reminder';
import { loadRemindersFromStorage } from './storage';

const STORAGE_KEY_TIME_HISTORY = '@remind_app_time_history_v1';
const MIN_HISTORY_FOR_INTELLIGENCE = 10;

export interface TimeUsageEntry {
  timestamp: number;
  hour: number; // 0 - 23
  dayOfWeek: number; // 0 - 6
}

/**
 * Save a newly scheduled reminder time into user history
 */
export async function recordUsedTime(dueAt: number): Promise<void> {
  try {
    const date = new Date(dueAt);
    const entry: TimeUsageEntry = {
      timestamp: dueAt,
      hour: date.getHours(),
      dayOfWeek: date.getDay(),
    };

    const raw = await AsyncStorage.getItem(STORAGE_KEY_TIME_HISTORY);
    let history: TimeUsageEntry[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(history)) history = [];

    history.push(entry);

    // Keep last 200 entries to maintain fresh patterns and light storage
    if (history.length > 200) {
      history = history.slice(history.length - 200);
    }

    await AsyncStorage.setItem(STORAGE_KEY_TIME_HISTORY, JSON.stringify(history));
  } catch (err) {
    console.warn('Failed to record time history:', err);
  }
}

/**
 * Calculate the default cold-start suggested time:
 * - If current minute > 30 min => next direct hour with :00 min
 * - If current minute <= 30 min => next-to-next hour with :00 min
 */
export function getDefaultColdStartTime(now = new Date()): Date {
  const suggested = new Date(now);
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();

  let targetHour: number;
  if (currentMinute > 30) {
    // Next direct hour (e.g. 5:35 PM -> 6:00 PM)
    targetHour = currentHour + 1;
  } else {
    // Next-to-next hour (e.g. 5:15 PM -> 7:00 PM)
    targetHour = currentHour + 2;
  }

  // Cap at 23 so it ALWAYS stays on TODAY (never rolling over to tomorrow)
  if (targetHour >= 24) {
    targetHour = 23;
  }

  suggested.setHours(targetHour, 0, 0, 0);
  // Guarantee date is strictly TODAY
  suggested.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());

  return suggested;
}

/**
 * Get intelligent suggested time:
 * - If user has < 10 recorded times, use default rule:
 *     (> 30 min -> next direct hour; <= 30 min -> next-to-next hour)
 * - If user has >= 10 recorded times:
 *     Analyze historical frequencies of reminder hours.
 *     Pick the most likely upcoming hour (:00) TODAY based on historical frequency!
 *     Default date is ALWAYS TODAY.
 */
export async function getIntelligentSuggestedTime(): Promise<{
  suggestedDate: Date;
  isHabitBased: boolean;
  frequencyCount: number;
}> {
  try {
    const now = new Date();

    // 1. Fetch historical records
    const raw = await AsyncStorage.getItem(STORAGE_KEY_TIME_HISTORY);
    let history: TimeUsageEntry[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(history)) history = [];

    // Also include hours from existing saved reminders
    const currentReminders: Reminder[] = await loadRemindersFromStorage();
    const reminderHours = currentReminders.map((r) => {
      const d = new Date(r.dueAt);
      return {
        timestamp: r.dueAt,
        hour: d.getHours(),
        dayOfWeek: d.getDay(),
      };
    });

    const combinedHistory = [...history, ...reminderHours];

    // 2. If insufficient data (< 10 entries), use user's cold-start rule for TODAY
    if (combinedHistory.length < MIN_HISTORY_FOR_INTELLIGENCE) {
      return {
        suggestedDate: getDefaultColdStartTime(now),
        isHabitBased: false,
        frequencyCount: combinedHistory.length,
      };
    }

    // 3. We have >= 10 entries! Compute hour frequency map (0..23)
    const hourFrequencyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      hourFrequencyMap[h] = 0;
    }

    for (const item of combinedHistory) {
      if (typeof item.hour === 'number' && item.hour >= 0 && item.hour < 24) {
        hourFrequencyMap[item.hour] = (hourFrequencyMap[item.hour] || 0) + 1;
      }
    }

    // 4. Candidate upcoming hours TODAY ONLY:
    // Ensure candidate is today and at least 30 minutes in the future
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const startHour = currentMinute > 30 ? currentHour + 1 : currentHour + 2;

    let bestCandidateHour: number | null = null;
    let maxFrequency = -1;

    // Search strictly within today's remaining hours (never tomorrow)
    if (startHour < 24) {
      for (let h = startHour; h < 24; h++) {
        const freq = hourFrequencyMap[h] || 0;
        if (freq > maxFrequency && freq > 0) {
          maxFrequency = freq;
          bestCandidateHour = h;
        }
      }
    }

    // If a learned frequent hour was found for today, use it on TODAY!
    if (bestCandidateHour !== null && maxFrequency >= 2) {
      const candidateDate = new Date(now);
      candidateDate.setHours(bestCandidateHour, 0, 0, 0);
      candidateDate.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
      return {
        suggestedDate: candidateDate,
        isHabitBased: true,
        frequencyCount: combinedHistory.length,
      };
    }

    // Otherwise fallback to the standard clean rule for today
    const fallbackDate = getDefaultColdStartTime(now);
    fallbackDate.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      suggestedDate: fallbackDate,
      isHabitBased: false,
      frequencyCount: combinedHistory.length,
    };
  } catch (error) {
    console.warn('Error in getIntelligentSuggestedTime, using default:', error);
    const fallbackDate = getDefaultColdStartTime();
    const now = new Date();
    fallbackDate.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      suggestedDate: fallbackDate,
      isHabitBased: false,
      frequencyCount: 0,
    };
  }
}
