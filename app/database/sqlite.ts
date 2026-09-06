import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  // Open modern expo-sqlite async database
  dbInstance = await SQLite.openDatabaseAsync('remind.db');

  // Configure SQLite pragmas for high performance & reliability
  await dbInstance.execAsync(`
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
  `);

  // Migration check: ensure repeatRule column exists for recurring reminders on existing databases
  try {
    const tableInfo = await dbInstance.getAllAsync<any>('PRAGMA table_info(reminders);');
    const hasRepeatCol = tableInfo.some((col: any) => col.name === 'repeatRule');
    if (!hasRepeatCol) {
      await dbInstance.execAsync('ALTER TABLE reminders ADD COLUMN repeatRule TEXT;');
    }
  } catch (migErr) {
    console.warn('SQLite migration warning (repeatRule):', migErr);
  }

  return dbInstance;
}
