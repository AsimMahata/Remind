import { v4 as uuidv4 } from 'uuid';
import { Event } from '../models/Event';
import { encryptPayload } from '../utils/crypto';

export interface LogEventParams {
  userId?: string | null;
  reminderId?: string | null;
  type: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Log an audit event. Encrypts payload with admin key and writes to MongoDB.
 * Non-blocking / fire-and-forget so it never slows down API responses.
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    const eventId = `evt_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const encryptedPayload = params.metadata ? encryptPayload(params.metadata) : '';
    const encryptedType = encryptPayload(params.type);

    await Event.create({
      id: eventId,
      userId: params.userId || null,
      reminderId: params.reminderId || null,
      type: params.type,
      encryptedType,
      encryptedPayload,
      timestamp: params.timestamp || Date.now(),
    });
  } catch (error) {
    console.error('[EventService] Failed to log event:', error);
  }
}
