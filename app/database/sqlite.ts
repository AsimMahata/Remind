import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Open modern expo-sqlite async database
  const db = await SQLite.openDatabaseAsync('remind.db');

  // Configure SQLite pragmas for high performance & reliability
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      userId TEXT,
      task TEXT NOT NULL,
      dueAt INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completedAt INTEGER,
      deleted INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER,
      notes TEXT DEFAULT '',
      notificationId TEXT,
      repeatRule TEXT,
      voiceNoteUri TEXT,
      version INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      syncStatus TEXT NOT NULL DEFAULT 'synced',
      serverUpdatedAt INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_reminders_user_deleted ON reminders (userId, deleted);
    CREATE INDEX IF NOT EXISTS idx_reminders_dueAt ON reminders (dueAt);
    CREATE INDEX IF NOT EXISTS idx_reminders_syncStatus ON reminders (syncStatus);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      reminderId TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      lastError TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue (createdAt);

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS purged_reminders (
      id TEXT PRIMARY KEY,
      purgedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_purged_reminders_id ON purged_reminders (id);

    CREATE TABLE IF NOT EXISTS alarms (
      id TEXT PRIMARY KEY,
      time TEXT NOT NULL,
      targetTimestamp INTEGER,
      label TEXT DEFAULT '',
      repeat TEXT DEFAULT 'once',
      enabled INTEGER NOT NULL DEFAULT 1,
      isTemporary INTEGER NOT NULL DEFAULT 0,
      soundUri TEXT DEFAULT 'default',
      vibrate INTEGER NOT NULL DEFAULT 1,
      notificationId TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_alarms_enabled ON alarms (enabled);
    CREATE INDEX IF NOT EXISTS idx_alarms_targetTimestamp ON alarms (targetTimestamp);
  `);

  // Migration check: ensure repeatRule column exists for recurring reminders on existing databases
  try {
    const tableInfo = await db.getAllAsync<any>('PRAGMA table_info(reminders);');
    const hasRepeatCol = tableInfo.some((col: any) => col.name === 'repeatRule');
    if (!hasRepeatCol) {
      await db.execAsync('ALTER TABLE reminders ADD COLUMN repeatRule TEXT;');
    }
    const hasVoiceNoteCol = tableInfo.some((col: any) => col.name === 'voiceNoteUri');
    if (!hasVoiceNoteCol) {
      await db.execAsync('ALTER TABLE reminders ADD COLUMN voiceNoteUri TEXT;');
    }

    const alarmTableInfo = await db.getAllAsync<any>('PRAGMA table_info(alarms);');
    const hasTargetTimestamp = alarmTableInfo.some((col: any) => col.name === 'targetTimestamp');
    if (!hasTargetTimestamp) {
      await db.execAsync('ALTER TABLE alarms ADD COLUMN targetTimestamp INTEGER;');
    }
  } catch (migErr) {
    console.warn('SQLite migration warning:', migErr);
  }

  return db;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initDatabase().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}
