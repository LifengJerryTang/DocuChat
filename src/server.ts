import app from './app';
import { config } from './config';
import { logger } from './logger';
import { prisma } from './lib/prisma';

// ── Start server ──────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  logger.info(`DocuChat API running on port ${config.port} [${config.nodeEnv}]`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    logger.info('Server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
