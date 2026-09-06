import { Reminder } from './reminder';

export type SyncOperationType = 'create' | 'update' | 'delete';

export interface SyncQueueItem {
  id: string;
  operation: SyncOperationType;
  reminderId: string;
  payload: string; // JSON encoded Reminder data
  createdAt: number;
  attempts: number;
  lastError?: string | null;
}

export interface ClientSyncChange {
  operation: SyncOperationType;
  id: string;
  data: Partial<Reminder>;
}

export interface BatchSyncRequest {
  lastSyncTimestamp: number;
  changes: ClientSyncChange[];
  purgedIds?: string[];
}

export interface BatchSyncResponse {
  serverTimestamp: number;
  applied: string[];
  rejected: { id: string; reason: string }[];
  serverChanges: Reminder[];
  purgedApplied?: string[];
}

export type SyncEngineStatus = 'idle' | 'syncing' | 'offline' | 'error';
