import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { User } from '../models/User';
import { ENV } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { logEvent } from '../services/eventService';

const router = Router();

const AuthSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * POST /auth/register
 */
router.post('/register', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = AuthSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { email, password } = parseResult.data;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = `usr_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const now = Date.now();

    const user = await User.create({
      id: userId,
      email,
      passwordHash,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      ENV.JWT_SECRET,
      { expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    logEvent({
      userId: user.id,
      type: 'USER_REGISTERED',
      metadata: { email: user.email },
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

/**
 * POST /auth/login
 */
router.post('/login', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = AuthSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { email, password } = parseResult.data;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      ENV.JWT_SECRET,
      { expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    logEvent({
      userId: user.id,
      type: 'USER_LOGIN',
      metadata: { email: user.email },
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

/**
 * POST /auth/logout
 */
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (req.user) {
    logEvent({
      userId: req.user.id,
      type: 'USER_LOGOUT',
      metadata: { email: req.user.email },
    });
  }
  res.json({ message: 'Logged out successfully.' });
});

/**
 * GET /auth/me
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ id: req.user!.id });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
