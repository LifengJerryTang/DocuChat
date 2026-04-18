import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createDocumentSchema,
  listDocumentsSchema,
  documentParamsSchema,
} from '../validators/document.validator';

const router = Router();

// All document routes require authentication
router.use(authenticate);

// ── GET /api/v1/documents ─────────────────────────────────────────────────────
router.get('/', validate(listDocumentsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    
    const { page, limit, status } = req.query as unknown as {
        page: number;
        limit: number;
        status?: string;
    };

    const where = {
      userId: req.user!.id,
      ...(status ? { status: status as string } : {}),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          filename: true,
          status: true,
          chunkCount: true,
          fileSizeBytes: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.document.count({ where }),
    ]);

    res.json({
      success: true,
      data: documents,
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
});

// ── POST /api/v1/documents ────────────────────────────────────────────────────
router.post('/', validate(createDocumentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, mimeType } = req.body;

    const document = await prisma.document.create({
      data: {
        userId: req.user!.id,
        title,
        filename: title.toLowerCase().replace(/\s+/g, '-') + '.txt',
        content,
        mimeType,
        fileSizeBytes: Buffer.byteLength(content, 'utf8'),
        status: 'pending',
      },
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/documents/:id ─────────────────────────────────────────────────
router.get('/:id', validate(documentParamsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id as string,
        userId: req.user!.id,  // ensures users can only access their own documents
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    res.json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/v1/documents/:id ──────────────────────────────────────────────
router.delete('/:id', validate(documentParamsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id as string, userId: req.user!.id },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    await prisma.document.delete({ where: { id: req.params.id as string } });

    res.json({ success: true, data: { message: 'Document deleted' } });
  } catch (error) {
    next(error);
  }
});

export default router;
