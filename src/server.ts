import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { logger } from './logger';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import conversationRoutes from './routes/conversations';
import './events/auth.events'; // registers all listeners on startup
import { prisma } from './lib/prisma';


const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
      success: true,
      data: {
        status: 'ok',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
      },
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/conversations', conversationRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  logger.info(`DocuChat API running on port ${config.port} [${config.nodeEnv}]`);
});

// ── Graceful shutdown (Day 2 — add prisma.$disconnect() here) ─────────────────
const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);
  // TODO (Day 2): await prisma.$disconnect();
  server.close(async () => {
    logger.info('Server closed');
    await prisma.$disconnect()
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
