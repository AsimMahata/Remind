import AsyncStorage from '@react-native-async-storage/async-storage';
import { Reminder, AppSettings, DEFAULT_SETTINGS } from '../types/reminder';

const STORAGE_KEYS = {
  REMINDERS: '@remind_app_reminders_v1',
  SETTINGS: '@remind_app_settings_v1',
};

export async function loadRemindersFromStorage(): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.REMINDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any legacy sample IDs from earlier testing
        return parsed.filter((r) => !r.id?.startsWith('sample-'));
      }
    }
    return [];
  } catch (error) {
    console.error('Failed to load reminders from AsyncStorage:', error);
    return [];
  }
}

export async function saveRemindersToStorage(reminders: Reminder[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
  } catch (error) {
    console.error('Failed to save reminders to AsyncStorage:', error);
  }
}

export async function loadSettingsFromStorage(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.voiceInputEnabled === undefined) {
        parsed.voiceInputEnabled = true;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to load settings from AsyncStorage:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to AsyncStorage:', error);
  }
}
