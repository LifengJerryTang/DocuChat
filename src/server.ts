import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { logger } from './logger';
import authRoutes from './routes/auth';
import './events/auth.events'; // registers all listeners on startup


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
    status: 'ok',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);

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
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
