import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createConversationSchema,
  conversationParamsSchema,
  sendMessageSchema,
  listMessagesSchema,
} from '../validators/conversation.validator';

const router = Router();

// All conversation routes require authentication
router.use(authenticate);

// ── GET /api/v1/conversations ─────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/v1/conversations ────────────────────────────────────────────────
router.post('/', validate(createConversationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, documentId } = req.body;

    // If a documentId is provided, verify the user owns that document
    if (documentId) {
      const doc = await prisma.document.findFirst({
        where: { id: documentId as string, userId: req.user!.id },
      });
      if (!doc) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Document not found' },
        });
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        userId: req.user!.id,
        title: title || null,
      },
    });

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/conversations/:id/messages ────────────────────────────────────
router.get(
  '/:id/messages',
  validate(listMessagesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };

      // Verify the conversation belongs to the user
      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id as string, userId: req.user!.id },
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' },
        });
      }

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where: { conversationId: req.params.id as string },
          orderBy: { createdAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            role: true,
            content: true,
            sources: true,
            confidence: true,
            promptTokens: true,
            completionTokens: true,
            costUsd: true,
            latencyMs: true,
            createdAt: true,
          },
        }),
        prisma.message.count({ where: { conversationId: req.params.id as string } }),
      ]);

      res.json({
        success: true,
        data: messages,
        meta: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── POST /api/v1/conversations/:id/messages ───────────────────────────────────
// Week 4 will wire this to the RAG pipeline. For now it saves the message directly.
router.post(
  '/:id/messages',
  validate(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content, documentId } = req.body;

      // Verify the conversation belongs to the user
      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id as string, userId: req.user!.id },
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' },
        });
      }

      // Save the user's message
      const userMessage = await prisma.message.create({
        data: {
          conversationId: req.params.id as string,
          documentId: documentId || null,
          role: 'user',
          content,
        },
      });

      // Placeholder assistant response (Week 4 replaces this with RAG)
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId: req.params.id as string,
          role: 'assistant',
          content: 'RAG pipeline not yet implemented. Check back in Week 4!',
        },
      });

      // Touch the conversation updatedAt so it sorts to the top of the list
      await prisma.conversation.update({
        where: { id: req.params.id as string },
        data: { updatedAt: new Date() },
      });

      res.status(201).json({
        success: true,
        data: { userMessage, assistantMessage },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
