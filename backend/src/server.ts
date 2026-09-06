import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { ENV } from './config/env';
import { connectDB } from './config/db';

import authRoutes from './routes/auth';
import syncRoutes from './routes/sync';
import remindersRoutes from './routes/reminders';
import adminRoutes from './routes/admin';

const app = express();

// Security & utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN.split(','),
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Detailed request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  // Safe body for logging (redact passwords)
  const safeBody = req.body ? { ...req.body } : {};
  if (safeBody.password) safeBody.password = '***REDACTED***';
  const bodySnippet = Object.keys(safeBody).length > 0 ? JSON.stringify(safeBody) : '';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const icon = status >= 400 ? '❌' : '✅';
    console.log(
      `[${new Date().toLocaleTimeString()}] ${icon} ${method} ${originalUrl} ${status} (${duration}ms) - IP: ${ip} ${
        bodySnippet ? `- Body: ${bodySnippet}` : ''
      }`
    );
  });

  next();
});

// Serve static admin dashboard assets
const candidatePaths = [
  path.join(__dirname, 'public/admin'),
  path.resolve(__dirname, '../src/public/admin'),
];
const adminStaticPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
app.use('/admin', express.static(adminStaticPath));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: ENV.NODE_ENV,
    timestamp: Date.now(),
  });
});

// Mount API routes
app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);
app.use('/reminders', remindersRoutes);
app.use('/admin', adminRoutes);

// Fallback for admin web dashboard navigation
app.get('/admin/*', (req: Request, res: Response) => {
  res.sendFile(path.join(adminStaticPath, 'index.html'));
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Connect to MongoDB and start server
async function startServer() {
  await connectDB();

  // Listen on 0.0.0.0 so physical phones and external devices on LAN can connect
  app.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🚀 Remind Backend running on port: ${ENV.PORT}`);
    console.log(`🌐 Local Network (Phone): http://10.2.30.157:${ENV.PORT}`);
    console.log(`📡 Localhost: http://localhost:${ENV.PORT}`);
    console.log(`🛡️  Admin Dashboard: http://localhost:${ENV.PORT}/admin`);
    console.log(`📝 Full HTTP request logging enabled.`);
    console.log(`=========================================`);
  });
}

startServer();

export default app;
