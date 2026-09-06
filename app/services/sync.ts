import NetInfo from '@react-native-community/netinfo';
import { Reminder } from '../types/reminder';
import {
  getPendingSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueFailure,
  upsertReminder,
  getSyncMeta,
  setSyncMeta,
  getActiveReminders,
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
        changes.push({
          operation: item.operation,
          id: item.reminderId,
          data: parsed,
        });
      } catch (e) {
        console.error('Failed to parse sync queue item payload:', e);
      }
    }

    // 2. Fetch last sync timestamp from local SQLite
    const lastSyncRaw = await getSyncMeta(LAST_SYNC_KEY);
    const lastSyncTimestamp = lastSyncRaw ? Number(lastSyncRaw) : 0;

    // 3. Make batch request to backend
    const res = await apiRequest<BatchSyncResponse>('/sync', {
      method: 'POST',
      body: JSON.stringify({
        lastSyncTimestamp,
        changes,
      }),
      timeoutMs: 12000,
    });

    // 4. Process applied IDs -> remove from queue and mark synced
    const appliedSet = new Set(res.applied || []);
    for (const item of queueItems) {
      if (appliedSet.has(item.reminderId)) {
        await removeSyncQueueItem(item.id);
        const local = await getActiveReminders(authState.user.id);
        const match = local.find((r) => r.id === item.reminderId);
        if (match) {
          match.syncStatus = 'synced';
          match.serverUpdatedAt = res.serverTimestamp;
          await upsertReminder(match, false);
        }
      }
    }

    // 5. Process server changes received from cloud
    let dataChanged = false;
    if (res.serverChanges && res.serverChanges.length > 0) {
      dataChanged = true;
      for (const serverItem of res.serverChanges) {
        // Upsert into local SQLite with false for enqueueSync to avoid infinite loop
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
