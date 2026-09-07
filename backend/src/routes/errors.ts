import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { ErrorReport } from '../models/ErrorReport';
import { encryptPayload } from '../utils/crypto';

const router = Router();

// Rate limiter for error reporting: max 30 error submissions per 15 min per IP
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many error reports from this IP, please try again later' },
});

const ReportErrorSchema = z.object({
  errorName: z.string().min(1).max(200),
  errorMessage: z.string().min(1).max(2000),
  stackTrace: z.string().optional().default(''),
  componentStack: z.string().optional().default(''),
  platform: z.string().optional().default('unknown'),
  osVersion: z.string().optional().default('unknown'),
  appVersion: z.string().optional().default('1.0.0'),
  context: z.record(z.unknown()).optional().default({}),
});

/**
 * Generate consistent fingerprint for deduplicating repeated errors
 */
function createErrorFingerprint(errorName: string, message: string, stack: string): string {
  const primaryStackLine = stack.split('\n').slice(0, 3).join('\n');
  const rawKey = `${errorName}::${message}::${primaryStackLine}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 32);
}

/**
 * POST /errors/report
 * Ingestion endpoint for application crashes & runtime errors
 */
router.post('/report', reportLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = ReportErrorSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid error report payload', details: parseResult.error.flatten() });
      return;
    }

    const {
      errorName,
      errorMessage,
      stackTrace,
      componentStack,
      platform,
      osVersion,
      appVersion,
      context,
    } = parseResult.data;

    const fingerprint = createErrorFingerprint(errorName, errorMessage, stackTrace);

    // Encrypt sensitive diagnostic metadata (device, memory, user id, state) with AES-256-GCM
    const encryptedContext = encryptPayload(context);

    // Default 7 days retention
    const defaultExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Group with an existing unsolved error if reported recently
    const existing = await ErrorReport.findOne({
      errorFingerprint: fingerprint,
      solved: false,
    });

    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = Date.now();
      existing.encryptedContext = encryptedContext;
      // Refresh 7-day TTL from last occurrence
      existing.expiresAt = defaultExpiresAt;
      await existing.save();

      res.status(200).json({ success: true, id: existing.id, deduplicated: true });
      return;
    }

    const newReport = new ErrorReport({
      id: uuidv4(),
      errorName,
      errorMessage,
      stackTrace,
      componentStack,
      platform,
      osVersion,
      appVersion,
      encryptedContext,
      errorFingerprint: fingerprint,
      count: 1,
      lastSeenAt: Date.now(),
      solved: false,
      solvedAt: null,
      createdAt: new Date(),
      expiresAt: defaultExpiresAt,
    });

    await newReport.save();

    res.status(201).json({ success: true, id: newReport.id, deduplicated: false });
  } catch (error) {
    console.error('Error report ingestion failed:', error);
    // Even if database fails, return safe status so client never crashes
    res.status(500).json({ error: 'Failed to record error report' });
  }
});

export default router;
