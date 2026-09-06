import NetInfo from '@react-native-community/netinfo';
import { Reminder } from '../types/reminder';
import {
  getPendingSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueFailure,
  upsertReminder,
  getSyncMeta,
  setSyncMeta,
  getReminderById,
  getPurgedReminderIds,
  removePurgedReminderIds,
  enqueueSyncOperation,
} from '../database/reminderDao';
import { apiRequest } from './api';
import { getAuthState } from './auth';
import {
  SyncEngineStatus,
  BatchSyncResponse,
  ClientSyncChange,
} from '../types/sync';

const LAST_SYNC_KEY = 'last_sync_timestamp';

let currentStatus: SyncEngineStatus = 'idle';
let isSyncRunning = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

type StatusListener = (status: SyncEngineStatus) => void;
type DataListener = () => void;

const statusListeners: Set<StatusListener> = new Set();
const dataListeners: Set<DataListener> = new Set();

function setStatus(status: SyncEngineStatus) {
  currentStatus = status;
  statusListeners.forEach((l) => l(status));
}

export function subscribeToSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export function subscribeToSyncData(listener: DataListener): () => void {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
}

export function getSyncStatus(): SyncEngineStatus {
  return currentStatus;
}

/**
 * Main synchronization execution routine
 * Enforces: LOCAL IS SOURCE OF TRUTH.
 * - Deleted items are never resurrected by the server.
 * - Discrepancies push the correct local state to the cloud DB.
 */
export async function performSync(): Promise<boolean> {
  const authState = getAuthState();
  if (!authState.isAuthenticated || !authState.user) {
    setStatus('idle');
    return false;
  }

  if (isSyncRunning) {
    return false;
  }

  isSyncRunning = true;
  setStatus('syncing');

  try {
    // 1. Fetch pending queue items
    const queueItems = await getPendingSyncQueue();
    const changes: ClientSyncChange[] = [];

    for (const item of queueItems) {
      try {
        const parsed = JSON.parse(item.payload);
        // Strip voiceNoteUri — audio files are device-local and must NEVER reach the server.
        // Replace with cloud-safe hasVoiceNote boolean so the server knows a recording exists.
        const { voiceNoteUri, ...cloudSafe } = parsed;
        cloudSafe.hasVoiceNote = !!(voiceNoteUri);
        changes.push({
          operation: item.operation,
          id: item.reminderId,
          data: cloudSafe,
        });
      } catch (e) {
        console.error('Failed to parse sync queue item payload:', e);
      }
    }

    // 2. Fetch last sync timestamp and purged IDs tombstone list
    const lastSyncRaw = await getSyncMeta(LAST_SYNC_KEY);
    const lastSyncTimestamp = lastSyncRaw ? Number(lastSyncRaw) : 0;
    const purgedIds = await getPurgedReminderIds();

    // 3. Make batch request to backend
    const res = await apiRequest<BatchSyncResponse>('/sync', {
      method: 'POST',
      body: JSON.stringify({
        lastSyncTimestamp,
        changes,
        purgedIds,
      }),
      timeoutMs: 12000,
    });

    // 4. Process applied IDs -> remove from queue and mark synced
    const appliedSet = new Set(res.applied || []);
    for (const item of queueItems) {
      if (appliedSet.has(item.reminderId)) {
        await removeSyncQueueItem(item.id);
        const local = await getReminderById(item.reminderId);
        if (local) {
          local.syncStatus = 'synced';
          local.serverUpdatedAt = res.serverTimestamp;
          await upsertReminder(local, false);
        }
      }
    }

    // Clean up acknowledged purged IDs
    if (res.purgedApplied && res.purgedApplied.length > 0) {
      await removePurgedReminderIds(res.purgedApplied);
    }

    // 5. Process server changes received from cloud (Local is Source of Truth!)
    let dataChanged = false;
    const purgedIdSet = new Set(purgedIds);

    if (res.serverChanges && res.serverChanges.length > 0) {
      for (const serverItem of res.serverChanges) {
        // Rule A: Was this reminder permanently purged on this device?
        if (purgedIdSet.has(serverItem.id)) {
          // Never resurrect! The server was already instructed to purge it.
          continue;
        }

        const local = await getReminderById(serverItem.id);

        if (local) {
          // Rule B: Local is source of truth for deletion!
          // If local is deleted (in trash), NEVER let the server resurrect it — regardless of server's deleted flag.
          if (local.deleted) {
            if (!serverItem.deleted) {
              // Server thinks it's active; re-push the delete so server catches up.
              await enqueueSyncOperation('delete', local);
            }
            // Either way, skip — do not upsert server data on a locally-deleted row.
            continue;
          }

          // Rule C: Local uncommitted edits (syncStatus === 'pending') must NOT be overwritten by server
          if (local.syncStatus === 'pending') {
            continue;
          }

          // Rule D: If local is active, but server says deleted:
          if (!local.deleted && serverItem.deleted) {
            // If local was updated more recently (e.g. restored or created locally), local truth wins!
            if ((local.updatedAt || 0) >= (serverItem.deletedAt || serverItem.updatedAt || 0)) {
              await enqueueSyncOperation('update', local);
              continue;
            }
          }
        } else {
          // Rule E: Item does not exist locally.
          // If server says deleted, do NOT insert old trash into this clean local state.
          if (serverItem.deleted) {
            continue;
          }
        }

        // Apply clean server update
        dataChanged = true;
        await upsertReminder(
          {
            ...serverItem,
            userId: authState.user.id,
            syncStatus: 'synced',
            serverUpdatedAt: serverItem.updatedAt,
          },
          false
        );
      }
    }

    // 6. Save new server sync timestamp
    if (res.serverTimestamp) {
      await setSyncMeta(LAST_SYNC_KEY, String(res.serverTimestamp));
    }

    setStatus('idle');

    if (dataChanged || changes.length > 0) {
      dataListeners.forEach((l) => l());
    }

    return true;
  } catch (err: any) {
    // In an offline-first app, network delays or offline states are normal, expected occurrences.
    // We log as informational debug instead of console.warn to avoid intrusive React Native LogBox toasts.
    console.log('[SyncEngine] Sync paused (offline or server unreachable):', err.message);
    setStatus('offline');

    // Record failure in queue items
    const queue = await getPendingSyncQueue();
    for (const item of queue) {
      await updateSyncQueueFailure(item.id, err.message || 'Offline mode');
    }

    // Schedule backoff retry in 15 seconds if authenticated
    if (authState.isAuthenticated) {
      scheduleRetry(15000);
    }
    return false;
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Debounced trigger for sync
 */
export function triggerSync(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    performSync();
  }, 1000);
}

function scheduleRetry(delayMs: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    performSync();
  }, delayMs);
}

/**
 * Setup listeners for network and app state
 */
export function setupSyncEngine(): () => void {
  // Listen for network connectivity returning
  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      triggerSync();
    } else {
      setStatus('offline');
    }
  });

  // Initial sync attempt
  triggerSync();

  return () => {
    unsubscribeNetInfo();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (retryTimer) clearTimeout(retryTimer);
  };
}
