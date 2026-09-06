import mongoose, { Document, Schema } from 'mongoose';
import { encryptPayload, decryptPayload } from '../utils/crypto';
import { ENV } from '../config/env';

export interface IEvent extends Document {
  id: string;
  userId?: string | null;
  reminderId?: string | null;
  type: string;
  encryptedType?: string;
  encryptedPayload: string;
  timestamp: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  getDecryptedPayload(): Record<string, unknown> | null;
}

const EventSchema = new Schema<IEvent>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, default: null, index: true },
    reminderId: { type: String, default: null, index: true },
    type: { type: String, required: true, index: true },
    encryptedType: { type: String },
    encryptedPayload: { type: String, default: '' },
    timestamp: { type: Number, default: () => Date.now(), index: true },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: (ENV.EVENT_TTL_DAYS || 7) * 24 * 60 * 60, // Auto-delete in MongoDB after TTL (default 7 days)
    },
  },
  {
    versionKey: false,
  }
);

// Compound indexes
EventSchema.index({ userId: 1, timestamp: -1 });
EventSchema.index({ type: 1, timestamp: -1 });

// Automatic trigger: encrypt payload and type before saving to database
EventSchema.pre('save', function (next) {
  if (!this.timestamp) {
    this.timestamp = Date.now();
  }
  if (!this.createdAt) {
    this.createdAt = new Date(this.timestamp);
  }
  // Encrypt event type
  if (this.type && !this.encryptedType) {
    this.encryptedType = encryptPayload(this.type);
  }
  // If temporary unencrypted metadata was attached, encrypt it into encryptedPayload
  if (this.metadata && !this.encryptedPayload) {
    this.encryptedPayload = encryptPayload(this.metadata);
  }
  next();
});

// Decryption helper method
EventSchema.methods.getDecryptedPayload = function (): Record<string, unknown> | null {
  if (!this.encryptedPayload) return null;
  return decryptPayload<Record<string, unknown>>(this.encryptedPayload);
};

export const Event = mongoose.model<IEvent>('Event', EventSchema);
