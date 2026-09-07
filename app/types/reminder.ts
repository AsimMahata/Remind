export type RepeatFrequency = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
export type CustomRepeatUnit = 'days' | 'weeks' | 'months';

export interface RepeatRule {
  frequency: RepeatFrequency;
  interval?: number; // e.g. 1, 2, 3...
  unit?: CustomRepeatUnit; // 'days' | 'weeks' | 'months' (when frequency === 'custom')
  daysOfWeek?: number[]; // [0..6] where 0=Sun, 1=Mon, ..., 6=Sat
  endDate?: number | null; // Unix timestamp in ms after which repetition stops
}

export interface Reminder {
  id: string;
  task: string;
  dueAt: number; // Unix timestamp in milliseconds
  completed: boolean;
  completedAt?: number | null;
  deleted?: boolean;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt?: number;
  notificationId?: string | null;
  notes?: string;
  repeat?: RepeatRule | null;

  // Voice note fields
  // voiceNoteUri is strictly local — never sent to the server
  voiceNoteUri?: string | null;
  // hasVoiceNote is the cloud-safe boolean flag sent during sync
  hasVoiceNote?: boolean;

  // Synchronization & Isolation fields
  syncStatus?: 'synced' | 'pending' | 'failed';
  serverUpdatedAt?: number;
  version?: number;
  userId?: string | null;
}

export type SectionType = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED';

export interface ReminderSection {
  title: string;
  type: SectionType;
  color: string;
  data: Reminder[];
}

export interface AppSettings {
  notificationsEnabled: boolean;
  voiceReminderEnabled: boolean;
  vibrateEnabled: boolean;
  quickTaskBarEnabled: boolean;
  soundEnabled: boolean;
  // Speech-to-text dictation — OFF by default
  voiceInputEnabled: boolean;
  // Voice notes are an advanced power-user feature — OFF by default
  voiceNotesEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  voiceReminderEnabled: false,
  vibrateEnabled: true,
  quickTaskBarEnabled: true,
  soundEnabled: true,
  voiceInputEnabled: true,
  voiceNotesEnabled: false,
};

