import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Reminder } from '../models/Reminder';
import { Event } from '../models/Event';
import { ENV } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { decryptPayload } from '../utils/crypto';

const router = Router();

/**
 * POST /admin/login
 * Dedicated admin login endpoint
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();
  const configuredAdminEmail = String(ENV.ADMIN_EMAIL || '').trim().toLowerCase();
  const configuredAdminPass = String(ENV.ADMIN_PASSWORD || '').trim();

  // 1. Check against master admin credentials in .env
  const isMasterAdmin =
    cleanEmail === configuredAdminEmail &&
    cleanPassword === configuredAdminPass;

  if (isMasterAdmin) {
    const token = jwt.sign(
      { id: 'admin_master', email: ENV.ADMIN_EMAIL, role: 'admin' },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: 'admin_master', email: ENV.ADMIN_EMAIL, role: 'admin' },
    });
    return;
  }

  // 2. Check if a registered user with role 'admin' exists
  const user = await User.findOne({ email: cleanEmail });
  if (user && user.role === 'admin') {
    const isMatch = await user.comparePassword(cleanPassword);
    if (isMatch) {
      const token = jwt.sign(
        { id: user.id, email: user.email, role: 'admin' },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({
        token,
        user: { id: user.id, email: user.email, role: 'admin' },
      });
      return;
    }
  }

  res.status(401).json({ error: 'Invalid admin credentials' });
});

// All following routes require authentication & admin role
router.use(requireAuth, requireAdmin);

/**
 * GET /admin/stats
 * Overview numbers for the admin dashboard
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const [totalUsers, activeReminders, completedReminders, deletedReminders, totalEvents] =
      await Promise.all([
        User.countDocuments(),
        Reminder.countDocuments({ deleted: false, completed: false }),
        Reminder.countDocuments({ completed: true, deleted: false }),
        Reminder.countDocuments({ deleted: true }),
        Event.countDocuments(),
      ]);

    res.json({
      totalUsers,
      activeReminders,
      completedReminders,
      deletedReminders,
      totalEvents,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

/**
 * GET /admin/users
 * Paginated list of users
 */
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();

    // Attach counts
    const usersWithCounts = await Promise.all(
      users.map(async (u) => {
        const reminderCount = await Reminder.countDocuments({ userId: u.id, deleted: false });
        return {
          ...u,
          reminderCount,
        };
      })
    );

    res.json(usersWithCounts);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /admin/reminders
 * List reminders with filters
 */
router.get('/reminders', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, completed, deleted, search } = req.query;
    const filter: Record<string, unknown> = {};

    if (userId) filter.userId = userId;
    if (completed !== undefined) filter.completed = completed === 'true';
    if (deleted !== undefined) filter.deleted = deleted === 'true';
    if (search) filter.task = { $regex: String(search), $options: 'i' };

    const reminders = await Reminder.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    res.json(reminders);
  } catch (error) {
    console.error('Admin reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

/**
 * GET /admin/events
 * Event audit log with filter support and payload decryption
 */
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, userId, startDate, endDate, limit = '50', skip = '0' } = req.query;
    const filter: Record<string, unknown> = {};

    if (type) filter.type = type;
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) (filter.timestamp as any).$gte = Number(startDate);
      if (endDate) (filter.timestamp as any).$lte = Number(endDate);
    }

    const events = await Event.find(filter)
      .sort({ timestamp: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .lean();

    // Decrypt the encrypted payload for admin inspection
    const decryptedEvents = events.map((e) => {
      let decryptedMetadata: Record<string, unknown> | null = null;
      if (e.encryptedPayload) {
        decryptedMetadata = decryptPayload<Record<string, unknown>>(e.encryptedPayload);
      }
      return {
        id: e.id,
        userId: e.userId,
        reminderId: e.reminderId,
        type: e.type,
        timestamp: e.timestamp,
        encryptedPayload: e.encryptedPayload,
        decryptedMetadata,
      };
    });

    res.json(decryptedEvents);
  } catch (error) {
    console.error('Admin events error:', error);
    res.status(500).json({ error: 'Failed to fetch event history' });
  }
});

export default router;
