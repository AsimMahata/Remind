import { Router, Request, Response } from 'express';
import { Reminder } from '../models/Reminder';
import { requireAuth } from '../middleware/auth';
import { logEvent } from '../services/eventService';

const router = Router();

export interface ClientSyncChange {
  operation: 'create' | 'update' | 'delete';
  id: string;
  data: {
    task?: string;
    dueAt?: number;
    completed?: boolean;
    completedAt?: number | null;
    deleted?: boolean;
    deletedAt?: number | null;
    notes?: string;
    notificationId?: string | null;
    createdAt?: number;
    updatedAt?: number;
    version?: number;
  };
}

/**
 * Handle processing an array of incoming push changes for a user
 */
async function processPushChanges(
  userId: string,
  changes: ClientSyncChange[]
): Promise<{ applied: string[]; rejected: { id: string; reason: string }[] }> {
  const applied: string[] = [];
  const rejected: { id: string; reason: string }[] = [];

  for (const change of changes) {
    try {
      const reminderId = change.id;
      const data = change.data || {};
      const clientUpdatedAt = data.updatedAt || Date.now();
      const clientCreatedAt = data.createdAt || Date.now();

      const existing = await Reminder.findOne({ userId, id: reminderId });

      if (change.operation === 'create') {
        if (!data.task || data.dueAt === undefined) {
          rejected.push({ id: reminderId, reason: 'Missing required task or dueAt' });
          continue;
        }

        if (existing) {
          // Idempotent retry: if existing is older or equal, update
          if (clientUpdatedAt >= existing.updatedAt) {
            existing.task = data.task;
            existing.dueAt = data.dueAt;
            existing.completed = !!data.completed;
            existing.completedAt = data.completedAt || null;
            existing.deleted = !!data.deleted;
            existing.deletedAt = data.deletedAt || null;
            existing.notes = data.notes || '';
            existing.updatedAt = clientUpdatedAt;
            existing.version = (existing.version || 1) + 1;
            await existing.save();
          }
          applied.push(reminderId);
        } else {
          await Reminder.create({
            id: reminderId,
            userId,
            task: data.task,
            dueAt: data.dueAt,
            completed: !!data.completed,
            completedAt: data.completedAt || null,
            deleted: !!data.deleted,
            deletedAt: data.deletedAt || null,
            notes: data.notes || '',
            notificationId: data.notificationId || null,
            version: data.version || 1,
            createdAt: clientCreatedAt,
            updatedAt: clientUpdatedAt,
          });
          applied.push(reminderId);

          logEvent({
            userId,
            reminderId,
            type: 'REMINDER_CREATED',
            metadata: { task: data.task, dueAt: data.dueAt },
          });
        }
      } else if (change.operation === 'update') {
        if (!existing) {
          // If not present on server, create it safely
          if (data.task && data.dueAt !== undefined) {
            await Reminder.create({
              id: reminderId,
              userId,
              task: data.task,
              dueAt: data.dueAt,
              completed: !!data.completed,
              completedAt: data.completedAt || null,
              deleted: !!data.deleted,
              deletedAt: data.deletedAt || null,
              notes: data.notes || '',
              notificationId: data.notificationId || null,
              version: data.version || 1,
              createdAt: clientCreatedAt,
              updatedAt: clientUpdatedAt,
            });
            applied.push(reminderId);
          } else {
            rejected.push({ id: reminderId, reason: 'Reminder not found for update' });
          }
          continue;
        }

        // Conflict resolution: Latest update wins
        if (clientUpdatedAt >= existing.updatedAt) {
          const wasCompleted = existing.completed;
          const oldDueAt = existing.dueAt;

          if (data.task !== undefined) existing.task = data.task;
          if (data.dueAt !== undefined) existing.dueAt = data.dueAt;
          if (data.completed !== undefined) {
            existing.completed = data.completed;
            existing.completedAt = data.completed ? (data.completedAt || Date.now()) : null;
          }
          if (data.notes !== undefined) existing.notes = data.notes;
          if (data.deleted !== undefined) existing.deleted = data.deleted;
          if (data.deletedAt !== undefined) existing.deletedAt = data.deletedAt;

          existing.updatedAt = clientUpdatedAt;
          existing.version = (existing.version || 1) + 1;
          await existing.save();

          applied.push(reminderId);

          // Audit events
          if (data.completed !== undefined && data.completed !== wasCompleted) {
            logEvent({
              userId,
              reminderId,
              type: data.completed ? 'REMINDER_COMPLETED' : 'REMINDER_UPDATED',
              metadata: { completed: data.completed },
            });
          } else if (data.dueAt !== undefined && data.dueAt !== oldDueAt) {
            logEvent({
              userId,
              reminderId,
              type: 'REMINDER_POSTPONED',
              metadata: { oldDueAt, newDueAt: data.dueAt },
            });
          } else {
            logEvent({
              userId,
              reminderId,
              type: 'REMINDER_UPDATED',
              metadata: { task: existing.task },
            });
          }
        } else {
          // Server version is newer; mark applied so client will accept server version on pull
          applied.push(reminderId);
        }
      } else if (change.operation === 'delete') {
        if (existing) {
          existing.deleted = true;
          existing.deletedAt = data.deletedAt || Date.now();
          existing.updatedAt = clientUpdatedAt;
          existing.version = (existing.version || 1) + 1;
          await existing.save();

          logEvent({
            userId,
            reminderId,
            type: 'REMINDER_DELETED',
            metadata: { deletedAt: existing.deletedAt },
          });
        }
        applied.push(reminderId);
      }
    } catch (err: any) {
      console.error(`Error processing change for ${change.id}:`, err);
      rejected.push({ id: change.id, reason: err.message || 'Unknown processing error' });
    }
  }

  return { applied, rejected };
}

/**
 * POST /sync
 * Unified bi-directional batch push & pull endpoint
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const lastSyncTimestamp = Number(req.body.lastSyncTimestamp) || 0;
  const changes: ClientSyncChange[] = Array.isArray(req.body.changes) ? req.body.changes : [];

  logEvent({
    userId,
    type: 'SYNC_STARTED',
    metadata: { changeCount: changes.length, lastSyncTimestamp },
  });

  try {
    // 1. Process client changes (Push)
    const { applied, rejected } = await processPushChanges(userId, changes);

    // 2. Fetch server changes since lastSyncTimestamp (Pull)
    // We include soft-deleted records so the client knows they were deleted on another device
    const serverChanges = await Reminder.find({
      userId,
      updatedAt: { $gt: lastSyncTimestamp },
    })
      .select('-_id id userId task dueAt completed completedAt deleted deletedAt notes notificationId version createdAt updatedAt')
      .lean();

    const serverTimestamp = Date.now();

    logEvent({
      userId,
      type: 'SYNC_SUCCEEDED',
      metadata: {
        appliedCount: applied.length,
        rejectedCount: rejected.length,
        serverChangesCount: serverChanges.length,
      },
    });

    res.json({
      serverTimestamp,
      applied,
      rejected,
      serverChanges,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    logEvent({
      userId,
      type: 'SYNC_FAILED',
      metadata: { error: error.message },
    });
    res.status(500).json({ error: 'Failed to synchronize reminders.' });
  }
});

/**
 * POST /sync/push
 * Push local changes only
 */
router.post('/push', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const changes: ClientSyncChange[] = Array.isArray(req.body.changes) ? req.body.changes : [];

  try {
    const { applied, rejected } = await processPushChanges(userId, changes);
    res.json({ serverTimestamp: Date.now(), applied, rejected });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Push failed' });
  }
});

/**
 * POST /sync/pull
 * Pull server changes since lastSyncTimestamp
 */
router.post('/pull', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const lastSyncTimestamp = Number(req.body.lastSyncTimestamp) || 0;

  try {
    const serverChanges = await Reminder.find({
      userId,
      updatedAt: { $gt: lastSyncTimestamp },
    })
      .select('-_id id userId task dueAt completed completedAt deleted deletedAt notes notificationId version createdAt updatedAt')
      .lean();

    res.json({
      serverTimestamp: Date.now(),
      serverChanges,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Pull failed' });
  }
});

export default router;
