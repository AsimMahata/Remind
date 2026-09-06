export interface Alarm {
  id: string;
  time: string; // 24-hour format string, e.g. "07:00", "22:30"
  targetTimestamp: number; // Exact calculated trigger timestamp in ms
  label?: string; // Optional user label, e.g. "Wake up", "Check oven"
  enabled: boolean;
  soundUri?: string; // 'default' | custom
  vibrate: boolean;
  notificationId?: string | null;
  createdAt: number;
  updatedAt: number;
}
