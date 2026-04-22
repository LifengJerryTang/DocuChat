import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/authorize';

import {
  createDocumentSchema,
  listDocumentsSchema,
  documentParamsSchema,
} from '../validators/document.validator';

const router = Router();

// All document routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /documents:
 *   get:
 *     summary: List all documents for the authenticated user
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, ready, failed] }
 *     responses:
 *       200:
 *         description: Paginated list of documents
 *       401:
 *         description: Unauthorized
 */
router.get('/', requirePermission('documents:read'), validate(listDocumentsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;

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

/**
 * @openapi
 * /documents:
 *   post:
 *     summary: Create (upload) a new document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *                 example: My Research Notes
 *               content:
 *                 type: string
 *                 example: Lorem ipsum...
 *               mimeType:
 *                 type: string
 *                 example: text/plain
 *     responses:
 *       201:
 *         description: Document created with status "pending"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', requirePermission('documents:create'), validate(createDocumentSchema), async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * @openapi
 * /documents/{id}:
 *   get:
 *     summary: Get a single document by ID
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Document UUID
 *     responses:
 *       200:
 *         description: Document object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */
router.get('/:id', requirePermission('documents:read'), validate(documentParamsSchema), async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     summary: Delete a document and all its chunks
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Document UUID
 *     responses:
 *       200:
 *         description: Document deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */
router.delete('/:id', requirePermission('documents:delete'), validate(documentParamsSchema), async (req: Request, res: Response, next: NextFunction) => {
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
