import mongoose, { Schema, Document } from 'mongoose';

export interface IErrorReport extends Document {
  id: string;
  errorName: string;
  errorMessage: string;
  stackTrace: string;
  componentStack?: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  encryptedContext: string;
  errorFingerprint: string;
  count: number;
  lastSeenAt: number;
  solved: boolean;
  solvedAt: number | null;
  createdAt: Date;
  expiresAt: Date;
}

const ErrorReportSchema = new Schema<IErrorReport>(
  {
    id: { type: String, required: true, unique: true, index: true },
    errorName: { type: String, required: true, index: true },
    errorMessage: { type: String, required: true },
    stackTrace: { type: String, default: '' },
    componentStack: { type: String, default: '' },
    platform: { type: String, required: true, default: 'unknown' },
    osVersion: { type: String, default: 'unknown' },
    appVersion: { type: String, default: '1.0.0' },
    encryptedContext: { type: String, default: '' },
    errorFingerprint: { type: String, required: true, index: true },
    count: { type: Number, default: 1 },
    lastSeenAt: { type: Number, default: () => Date.now() },
    solved: { type: Boolean, default: false, index: true },
    solvedAt: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now },
    // MongoDB TTL Index: automatically deletes documents when expiresAt timestamp is reached
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    versionKey: false,
  }
);

// Compound index for finding matching recent unsolved errors
ErrorReportSchema.index({ errorFingerprint: 1, solved: 1 });

export const ErrorReport = mongoose.model<IErrorReport>(
  'ErrorReport',
  ErrorReportSchema
);
