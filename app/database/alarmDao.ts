import { getDatabase } from './sqlite';
import { Alarm } from '../types/alarm';

interface AlarmDbRow {
  id: string;
  time: string;
  targetTimestamp: number | null;
  label: string | null;
  enabled: number;
  soundUri: string | null;
  vibrate: number;
  notificationId: string | null;
  createdAt: number;
  updatedAt: number;
}

function mapRowToAlarm(row: AlarmDbRow): Alarm {
  // If targetTimestamp wasn't stored, calculate from time string
  let targetTs = row.targetTimestamp;
  if (!targetTs) {
    const [hStr, mStr] = row.time.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    targetTs = target.getTime();
  }

  return {
    id: row.id,
    time: row.time,
    targetTimestamp: targetTs,
    label: row.label || '',
    enabled: row.enabled === 1,
    soundUri: row.soundUri || 'default',
    vibrate: row.vibrate === 1,
    notificationId: row.notificationId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Retrieve all active alarms from the local database sorted by upcoming trigger time
 */
export async function getAllAlarmsFromDb(): Promise<Alarm[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AlarmDbRow>(
    `SELECT * FROM alarms ORDER BY targetTimestamp ASC, time ASC;`
  );
  return rows.map(mapRowToAlarm);
}

/**
 * Retrieve an alarm by its unique ID
 */
export async function getAlarmByIdFromDb(id: string): Promise<Alarm | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AlarmDbRow>(
    `SELECT * FROM alarms WHERE id = ?;`,
    [id]
  );
  return row ? mapRowToAlarm(row) : null;
}

/**
 * Insert or update an alarm in the local database
 */
export async function upsertAlarmInDb(alarm: Alarm): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO alarms (
      id, time, targetTimestamp, label, repeat, enabled, isTemporary, soundUri, vibrate, notificationId, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, 'once', ?, 1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      time = excluded.time,
      targetTimestamp = excluded.targetTimestamp,
      label = excluded.label,
      enabled = excluded.enabled,
      soundUri = excluded.soundUri,
      vibrate = excluded.vibrate,
      notificationId = excluded.notificationId,
      updatedAt = excluded.updatedAt;`,
    [
      alarm.id,
      alarm.time,
      alarm.targetTimestamp,
      alarm.label || '',
      alarm.enabled ? 1 : 0,
      alarm.soundUri || 'default',
      alarm.vibrate ? 1 : 0,
      alarm.notificationId || null,
      alarm.createdAt || now,
      alarm.updatedAt || now,
    ]
  );
}

/**
 * Toggle an alarm enabled/disabled state in local database
 */
export async function setAlarmEnabledInDb(id: string, enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE alarms SET enabled = ?, updatedAt = ? WHERE id = ?;`,
    [enabled ? 1 : 0, Date.now(), id]
  );
}

/**
 * Delete an alarm completely from the local database
 */
export async function deleteAlarmFromDb(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM alarms WHERE id = ?;`, [id]);
}
