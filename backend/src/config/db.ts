import mongoose from 'mongoose';
import { ENV } from './env';

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(ENV.MONGODB_URI);
  console.log(`[MongoDB] Connected successfully to: ${ENV.MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection lost. Attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Reconnected successfully.');
  });
}
