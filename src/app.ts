import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { logger } from './logger';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import conversationRoutes from './routes/conversations';
import adminRoutes from './routes/admin';
import './queues/document.worker';  
import './events/admin.events';
import './events/auth.events';
import './events/document.events'; // audit trail for document create/delete
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { bullBoardAdapter } from './config/bull-board';
import webhookRoutes from './routes/webhooks';
import { verifyWebhookSignature } from './middleware/verifyWebhook';


const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  '/webhooks',
  verifyWebhookSignature(process.env.WEBHOOK_SECRET!, 'X-Webhook-Signature'),
  express.raw({
    type: 'application/json',
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }),
  webhookRoutes
);

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
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/admin/queues', bullBoardAdapter.getRouter());

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.path} not found` },
  });
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;
