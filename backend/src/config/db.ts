import mongoose from 'mongoose';
import { ENV } from './env';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(ENV.MONGODB_URI);
    console.log(`[MongoDB] Connected successfully to: ${ENV.MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    console.warn('[MongoDB] Server will continue running, but database operations may fail until MongoDB is available.');
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection lost. Attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Reconnected successfully.');
  });
}
