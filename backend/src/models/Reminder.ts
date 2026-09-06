import mongoose, { Document, Schema } from 'mongoose';

export interface IReminder extends Document {
  id: string;
  userId: string;
  task: string;
  dueAt: number;
  completed: boolean;
  completedAt?: number | null;
  deleted: boolean;
  deletedAt?: number | null;
  notes?: string;
  notificationId?: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
}

const ReminderSchema = new Schema<IReminder>(
  {
    id: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    task: { type: String, required: true, trim: true },
    dueAt: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Number, default: null },
    deleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Number, default: null },
    notes: { type: String, default: '' },
    notificationId: { type: String, default: null },
    version: { type: Number, default: 1 },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now(), index: true },
  },
  {
    versionKey: false,
  }
);

// Compound indexes for fast synchronization and isolation
ReminderSchema.index({ userId: 1, id: 1 }, { unique: true });
ReminderSchema.index({ userId: 1, updatedAt: -1 });
ReminderSchema.index({ userId: 1, deleted: 1 });

// Automatic trigger for updatedAt
ReminderSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (this.completed && !this.completedAt) {
    this.completedAt = Date.now();
  } else if (!this.completed) {
    this.completedAt = null;
  }
  if (this.deleted && !this.deletedAt) {
    this.deletedAt = Date.now();
  }
  next();
});

export const Reminder = mongoose.model<IReminder>('Reminder', ReminderSchema);
