import { getDatabase } from './sqlite';
import { Reminder } from '../types/reminder';
import { SyncQueueItem, SyncOperationType } from '../types/sync';

/**
 * Map raw SQLite row to typed Reminder object
 */
function rowToReminder(row: any): Reminder {
  let repeat = null;
  if (row.repeatRule) {
    try {
      repeat = typeof row.repeatRule === 'string' ? JSON.parse(row.repeatRule) : row.repeatRule;
    } catch {
      repeat = null;
    }
  }

  return {
    id: row.id,
    userId: row.userId || null,
    task: row.task,
    dueAt: Number(row.dueAt),
    completed: Boolean(row.completed),
    completedAt: row.completedAt ? Number(row.completedAt) : null,
    deleted: Boolean(row.deleted),
    deletedAt: row.deletedAt ? Number(row.deletedAt) : null,
    notes: row.notes || '',
    notificationId: row.notificationId || null,
    repeat,
    version: Number(row.version || 1),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    syncStatus: row.syncStatus as any,
    serverUpdatedAt: row.serverUpdatedAt ? Number(row.serverUpdatedAt) : undefined,
  };
}

/**
 * Fetch all active (non-deleted) reminders for the current active user
 * If userId is null (logged out), returns local offline reminders
 * If userId is provided, returns reminders belonging to that user
 */
export async function getActiveReminders(userId?: string | null): Promise<Reminder[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM reminders WHERE deleted = 0';
  const params: any[] = [];

  if (userId) {
    // Return reminders for this user, plus any guest reminders yet to be migrated
    query += ' AND (userId = ? OR userId IS NULL)';
    params.push(userId);
  } else {
    // Logged out: return all offline reminders or unassigned reminders
    query += ' AND (userId IS NULL OR userId = "")';
  }

  query += ' ORDER BY dueAt ASC';
  const rows = await db.getAllAsync<any>(query, params);
  return rows.map(rowToReminder);
}

/**
 * Fetch a single reminder by ID
 */
export async function getReminderById(id: string): Promise<Reminder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM reminders WHERE id = ?', [id]);
  return row ? rowToReminder(row) : null;
}

/**
 * Insert or update a reminder in SQLite
 */
export async function upsertReminder(
  reminder: Reminder,
  shouldEnqueueSync: boolean = false
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  const updatedAt = reminder.updatedAt || now;
  const createdAt = reminder.createdAt || now;

  await db.runAsync(
    `INSERT INTO reminders (
      id, userId, task, dueAt, completed, completedAt, deleted, deletedAt,
      notes, notificationId, repeatRule, version, createdAt, updatedAt, syncStatus, serverUpdatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId = COALESCE(excluded.userId, reminders.userId),
      task = excluded.task,
      dueAt = excluded.dueAt,
      completed = excluded.completed,
      completedAt = excluded.completedAt,
      -- Local deletion is source of truth: once deleted locally, never un-delete via server upsert.
      -- MAX() keeps deleted=1 if either side has it set.
      deleted = MAX(reminders.deleted, excluded.deleted),
      deletedAt = CASE
        WHEN reminders.deleted = 1 THEN reminders.deletedAt
        ELSE excluded.deletedAt
      END,
      notes = excluded.notes,
      notificationId = excluded.notificationId,
      repeatRule = excluded.repeatRule,
      version = excluded.version,
      updatedAt = excluded.updatedAt,
      syncStatus = excluded.syncStatus,
      serverUpdatedAt = excluded.serverUpdatedAt`,
    [
      reminder.id,
      reminder.userId || null,
      reminder.task,
      reminder.dueAt,
      reminder.completed ? 1 : 0,
      reminder.completedAt || null,
      reminder.deleted ? 1 : 0,
      reminder.deletedAt || null,
      reminder.notes || '',
      reminder.notificationId || null,
      reminder.repeat ? JSON.stringify(reminder.repeat) : null,
      reminder.version || 1,
      createdAt,
      updatedAt,
      reminder.syncStatus || 'pending',
      reminder.serverUpdatedAt || null,
    ]
  );

  if (shouldEnqueueSync) {
    const op: SyncOperationType = reminder.deleted
      ? 'delete'
      : reminder.version && reminder.version > 1
      ? 'update'
      : 'create';
    await enqueueSyncOperation(op, reminder);
  }
}

/**
 * Soft delete a reminder in SQLite
 */
export async function softDeleteReminder(
  id: string,
  shouldEnqueueSync: boolean = true
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  const existing = await getReminderById(id);
  if (!existing) return;

  const updated: Reminder = {
    ...existing,
    deleted: true,
    deletedAt: now,
    updatedAt: now,
    version: (existing.version || 1) + 1,
    syncStatus: 'pending',
  };

  await db.runAsync(
    `UPDATE reminders SET
      deleted = 1,
      deletedAt = ?,
      updatedAt = ?,
      version = version + 1,
      syncStatus = 'pending'
    WHERE id = ?`,
    [now, now, id]
  );

  if (shouldEnqueueSync) {
    await enqueueSyncOperation('delete', updated);
  }
}

/**
 * Soft delete multiple reminders in SQLite at once
 */
export async function softDeleteMultipleReminders(
  ids: string[],
  shouldEnqueueSync: boolean = true
): Promise<Reminder[]> {
  if (!ids || ids.length === 0) return [];
  const db = await getDatabase();
  const now = Date.now();
  const deletedReminders: Reminder[] = [];

  for (const id of ids) {
    const existing = await getReminderById(id);
    if (!existing) continue;

    const updated: Reminder = {
      ...existing,
      deleted: true,
      deletedAt: now,
      updatedAt: now,
      version: (existing.version || 1) + 1,
      syncStatus: 'pending',
    };

    await db.runAsync(
      `UPDATE reminders SET
        deleted = 1,
        deletedAt = ?,
        updatedAt = ?,
        version = version + 1,
        syncStatus = 'pending'
      WHERE id = ?`,
      [now, now, id]
    );

    if (shouldEnqueueSync) {
      await enqueueSyncOperation('delete', updated);
    }
    deletedReminders.push(updated);
  }

  return deletedReminders;
}

/**
 * Enqueue an operation into the sync_queue outbox
 */
export async function enqueueSyncOperation(
  operation: SyncOperationType,
  reminder: Reminder
): Promise<void> {
  const db = await getDatabase();
  const queueId = `sq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO sync_queue (id, operation, reminderId, payload, createdAt, attempts, lastError)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    [queueId, operation, reminder.id, JSON.stringify(reminder), now]
  );
}

/**
 * Get all pending sync queue items sorted by createdAt ASC
 */
export async function getPendingSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sync_queue ORDER BY createdAt ASC LIMIT 50'
  );
  return rows.map((r) => ({
    id: r.id,
    operation: r.operation as SyncOperationType,
    reminderId: r.reminderId,
    payload: r.payload,
    createdAt: Number(r.createdAt),
    attempts: Number(r.attempts),
    lastError: r.lastError,
  }));
}

/**
 * Remove an item from the sync_queue upon successful push
 */
export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

/**
 * Record a failure attempt for a sync queue item
 */
export async function updateSyncQueueFailure(id: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE sync_queue SET attempts = attempts + 1, lastError = ? WHERE id = ?',
    [error, id]
  );
}

/**
 * Count unassigned reminders created while logged out (offline use)
 */
export async function countOfflineReminders(): Promise<number> {
  const db = await getDatabase();
  const res = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM reminders WHERE (userId IS NULL OR userId = "") AND deleted = 0'
  );
  return res?.count || 0;
}

/**
 * Migrate offline unassigned reminders to an authenticated user
 */
export async function assignOfflineRemindersToUser(userId: string): Promise<Reminder[]> {
  const db = await getDatabase();
  const now = Date.now();

  // 1. Fetch offline reminders
  const offlineRows = await db.getAllAsync<any>(
    'SELECT * FROM reminders WHERE (userId IS NULL OR userId = "") AND deleted = 0'
  );
  const reminders = offlineRows.map(rowToReminder);

  // 2. Update their userId in SQLite
  await db.runAsync(
    'UPDATE reminders SET userId = ?, syncStatus = "pending", updatedAt = ? WHERE (userId IS NULL OR userId = "") AND deleted = 0',
    [userId, now]
  );

  // 3. Enqueue create sync operation for each so they push to user account
  for (const r of reminders) {
    const updated = { ...r, userId, syncStatus: 'pending' as const };
    await enqueueSyncOperation('create', updated);
  }

  return reminders;
}

/**
 * Meta helpers
 */
export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    [key]
  );
  return row ? row.value : null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

/**
 * Fetch all soft-deleted reminders (Trash)
 */
export async function getDeletedReminders(userId?: string | null): Promise<Reminder[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM reminders WHERE deleted = 1';
  const params: any[] = [];

  if (userId) {
    query += ' AND (userId = ? OR userId IS NULL)';
    params.push(userId);
  } else {
    query += ' AND (userId IS NULL OR userId = "")';
  }

  query += ' ORDER BY deletedAt DESC';
  const rows = await db.getAllAsync<any>(query, params);
  return rows.map(rowToReminder);
}

/**
 * Restore a soft-deleted reminder
 */
export async function restoreReminderInDb(id: string): Promise<Reminder | null> {
  const db = await getDatabase();
  const existing = await getReminderById(id);
  if (!existing) return null;

  const now = Date.now();
  const restored: Reminder = {
    ...existing,
    deleted: false,
    deletedAt: null,
    updatedAt: now,
    syncStatus: 'pending',
    version: (existing.version || 1) + 1,
  };

  await db.runAsync(
    `UPDATE reminders SET
      deleted = 0,
      deletedAt = NULL,
      updatedAt = ?,
      version = version + 1,
      syncStatus = 'pending'
    WHERE id = ?`,
    [now, id]
  );

  // If it was previously tracked in purged_reminders, remove it
  await db.runAsync('DELETE FROM purged_reminders WHERE id = ?', [id]);

  await enqueueSyncOperation('update', restored);
  return restored;
}

/**
 * Add IDs to the persistent purged_reminders tombstone table
 */
export async function addPurgedReminderIds(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getDatabase();
  const now = Date.now();
  for (const id of ids) {
    await db.runAsync(
      'INSERT INTO purged_reminders (id, purgedAt) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET purgedAt = excluded.purgedAt',
      [id, now]
    );
  }
}

/**
 * Retrieve all purged reminder IDs
 */
export async function getPurgedReminderIds(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM purged_reminders');
  return rows.map((r) => r.id);
}

/**
 * Check if a reminder ID has been permanently purged locally
 */
export async function isReminderPurged(id: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM purged_reminders WHERE id = ?', [id]);
  return !!row;
}

/**
 * Remove purged reminder IDs once successfully deleted on the cloud server
 */
export async function removePurgedReminderIds(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM purged_reminders WHERE id IN (${placeholders})`, ids);
}

/**
 * Permanently delete soft-deleted reminders (Empty Trash / Purge Data).
 * Records their IDs in purged_reminders tombstone table so they are never resurrected.
 */
export async function purgeDeletedRemindersFromDb(userId?: string | null): Promise<number> {
  const db = await getDatabase();
  let userClause = '';
  const params: any[] = [];

  if (userId) {
    userClause = ' AND (userId = ? OR userId IS NULL)';
    params.push(userId);
  } else {
    userClause = ' AND (userId IS NULL OR userId = "")';
  }

  // 1. Fetch IDs of reminders being purged
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM reminders WHERE deleted = 1${userClause}`,
    params
  );
  const ids = rows.map((r) => r.id);

  // 2. Add to tombstone table so sync never resurrects them
  if (ids.length > 0) {
    await addPurgedReminderIds(ids);
  }

  // 3. Delete from reminders table
  const query = `DELETE FROM reminders WHERE deleted = 1${userClause}`;
  const res = await db.runAsync(query, params);
  return res.changes;
}

/**
 * Get live stats of reminders (active, completed, deleted, total)
 */
export async function getReminderStats(
  userId?: string | null
): Promise<{ active: number; completed: number; deleted: number; total: number }> {
  const db = await getDatabase();
  let userClause = '';
  const params: any[] = [];

  if (userId) {
    userClause = ' AND (userId = ? OR userId IS NULL)';
    params.push(userId);
  } else {
    userClause = ' AND (userId IS NULL OR userId = "")';
  }

  const [activeRes, completedRes, deletedRes] = await Promise.all([
    db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM reminders WHERE deleted = 0 AND completed = 0${userClause}`,
      params
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM reminders WHERE deleted = 0 AND completed = 1${userClause}`,
      params
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM reminders WHERE deleted = 1${userClause}`,
      params
    ),
  ]);

  const active = activeRes?.count || 0;
  const completed = completedRes?.count || 0;
  const deleted = deletedRes?.count || 0;

  return {
    active,
    completed,
    deleted,
    total: active + completed + deleted,
  };
}

