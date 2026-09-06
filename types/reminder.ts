export interface Reminder {
  id: string;
  task: string;
  dueAt: number; // Unix timestamp in milliseconds
  completed: boolean;
  completedAt?: number | null;
  createdAt: number;
  notificationId?: string | null;
  notes?: string;
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
}

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  voiceReminderEnabled: true,
  vibrateEnabled: true,
  quickTaskBarEnabled: true,
  soundEnabled: true,
};
