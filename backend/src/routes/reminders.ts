import { Router, Request, Response } from 'express';
import { Reminder } from '../models/Reminder';
import { requireAuth } from '../middleware/auth';
import { logEvent } from '../services/eventService';

const router = Router();

// All reminder endpoints require user authentication
router.use(requireAuth);

/**
 * GET /reminders
 * List user's active reminders (not soft-deleted)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const reminders = await Reminder.find({ userId, deleted: false })
      .sort({ dueAt: 1 })
      .select('-_id id userId task dueAt completed completedAt notes notificationId repeat version createdAt updatedAt')
      .lean();

    res.json(reminders);
  } catch (error) {
    console.error('List reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

/**
 * POST /reminders
 * Create a single reminder
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id, task, dueAt, notes, notificationId, repeat } = req.body;

    if (!task || !dueAt) {
      res.status(400).json({ error: 'Task and dueAt are required' });
      return;
    }

    const reminderId = id || `remind_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const reminder = await Reminder.create({
      id: reminderId,
      userId,
      task: task.trim(),
      dueAt: Number(dueAt),
      completed: false,
      notes: notes || '',
      notificationId: notificationId || null,
      repeat: repeat || null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    logEvent({
      userId,
      reminderId,
      type: 'REMINDER_CREATED',
      metadata: { task: reminder.task, dueAt: reminder.dueAt },
    });

    res.status(201).json(reminder);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

/**
 * PUT /reminders/:id
 * Update a reminder
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const updates = req.body;

    const reminder = await Reminder.findOne({ userId, id });
    if (!reminder) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    if (updates.task !== undefined) reminder.task = updates.task.trim();
    if (updates.dueAt !== undefined) reminder.dueAt = Number(updates.dueAt);
    if (updates.completed !== undefined) {
      reminder.completed = !!updates.completed;
      reminder.completedAt = updates.completed ? Date.now() : null;
    }
    if (updates.notes !== undefined) reminder.notes = updates.notes;
    if (updates.repeat !== undefined) reminder.repeat = updates.repeat;
    if (updates.notificationId !== undefined) {
      reminder.notificationId = updates.notificationId ? String(updates.notificationId) : null;
    }

    reminder.updatedAt = Date.now();
    reminder.version = (reminder.version || 1) + 1;
    await reminder.save();

    logEvent({
      userId,
      reminderId: id,
      type: updates.completed ? 'REMINDER_COMPLETED' : 'REMINDER_UPDATED',
      metadata: { task: reminder.task },
    });

    res.json(reminder);
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

/**
 * DELETE /reminders/:id
 * Soft delete a reminder
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const reminder = await Reminder.findOne({ userId, id });
    if (!reminder) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    reminder.deleted = true;
    reminder.deletedAt = Date.now();
    reminder.updatedAt = Date.now();
    reminder.version = (reminder.version || 1) + 1;
    await reminder.save();

    logEvent({
      userId,
      reminderId: id,
      type: 'REMINDER_DELETED',
      metadata: { deletedAt: reminder.deletedAt },
    });

    res.json({ message: 'Reminder soft-deleted', id });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

/**
 * GET /reminders/user-stats
 * Get counts of active, completed, and soft-deleted reminders for user
 */
router.get('/user-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const [active, completed, deleted, total] = await Promise.all([
      Reminder.countDocuments({ userId, deleted: false, completed: false }),
      Reminder.countDocuments({ userId, deleted: false, completed: true }),
      Reminder.countDocuments({ userId, deleted: true }),
      Reminder.countDocuments({ userId }),
    ]);

    res.json({ active, completed, deleted, total });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to fetch reminder stats' });
  }
});

/**
 * GET /reminders/trash
 * List all recoverable soft-deleted reminders
 */
router.get('/trash', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const deletedReminders = await Reminder.find({ userId, deleted: true })
      .sort({ deletedAt: -1 })
      .select('-_id id userId task dueAt completed completedAt deleted deletedAt notes notificationId repeat version createdAt updatedAt')
      .lean();

    res.json(deletedReminders);
  } catch (error) {
    console.error('Fetch trash error:', error);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

/**
 * POST /reminders/:id/restore
 * Recover / restore a soft-deleted reminder
 */
router.post('/:id/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const reminder = await Reminder.findOne({ userId, id });
    if (!reminder) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    reminder.deleted = false;
    reminder.deletedAt = null;
    reminder.updatedAt = Date.now();
    reminder.version = (reminder.version || 1) + 1;
    await reminder.save();

    logEvent({
      userId,
      reminderId: id,
      type: 'REMINDER_RESTORED',
      metadata: { task: reminder.task },
    });

    res.json({ message: 'Reminder restored successfully', reminder });
  } catch (error) {
    console.error('Restore reminder error:', error);
    res.status(500).json({ error: 'Failed to restore reminder' });
  }
});

/**
 * POST /reminders/purge-deleted
 * Permanently delete all soft-deleted reminders from the database
 */
router.post('/purge-deleted', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await Reminder.deleteMany({ userId, deleted: true });

    logEvent({
      userId,
      type: 'DATA_PURGED',
      metadata: { purgedCount: result.deletedCount },
    });

    res.json({
      message: 'Permanently deleted all trash reminders',
      purgedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Purge deleted reminders error:', error);
    res.status(500).json({ error: 'Failed to purge deleted reminders' });
  }
});

export default router;
