import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/authorize';
import {
  listConversations,
  createConversation,
  sendMessage,
  getMessages,
} from '../services/conversation.service';
import {
  createConversationSchema,
  conversationParamsSchema,
  sendMessageSchema,
  listMessagesSchema,
} from '../validators/conversation.validator';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /conversations:
 *   get:
 *     summary: List all conversations with last message preview
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated conversations with messageCount and lastMessage
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  requirePermission('conversations:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listConversations(req.user!.id, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /conversations:
 *   post:
 *     summary: Start a new conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               documentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Conversation created
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */
router.post(
  '/',
  requirePermission('conversations:create'),
  validate(createConversationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await createConversation({
        userId: req.user!.id,
        title: req.body.title,
        documentId: req.body.documentId,
      });
      res.status(201).json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /conversations/{id}/messages:
 *   get:
 *     summary: Get paginated messages for a conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated messages oldest-first
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.get(
  '/:id/messages',
  requirePermission('conversations:read'),
  validate(listMessagesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await getMessages(req.params.id as string, req.user!.id, { page, limit });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /conversations/{id}/messages:
 *   post:
 *     summary: Send a message (transactional — user + assistant + usage log)
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *               documentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: User + assistant messages created atomically
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.post(
  '/:id/messages',
  requirePermission('conversations:create'),
  validate(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sendMessage({
        conversationId: req.params.id as string,
        userId: req.user!.id,
        content: req.body.content,
        documentId: req.body.documentId,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
