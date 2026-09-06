import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/remind',
  JWT_SECRET: process.env.JWT_SECRET || 'remind_super_secret_jwt_key_development_change_in_production_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@remind.local',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  EVENT_TTL_DAYS: parseInt(process.env.EVENT_TTL_DAYS || '7', 10),
};

