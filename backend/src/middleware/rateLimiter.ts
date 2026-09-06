import rateLimit from 'express-rate-limit';
import { ENV } from '../config/env';

export const authRateLimiter = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: ENV.RATE_LIMIT_MAX, // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
  },
});
