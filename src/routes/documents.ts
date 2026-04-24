import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requirePermission } from '../middleware/authorize';
import {
  listDocuments,
  getDocument,
  createDocument,
  deleteDocument,
} from '../services/document.service';
import {
  createDocumentSchema,
  listDocumentsSchema,
  documentParamsSchema,
} from '../validators/document.validator';

const router = Router();

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
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, title, chunkCount] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Paginated list of documents
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  requirePermission('documents:read'),
  validate(listDocumentsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listDocuments(req.user!.id, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        sortBy: req.query.sortBy as 'createdAt' | 'title' | 'chunkCount' | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

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
 *               content:
 *                 type: string
 *               mimeType:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document created with status "pending"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  requirePermission('documents:create'),
  validate(createDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await createDocument({
        userId: req.user!.id,
        title: req.body.title,
        content: req.body.content,
        mimeType: req.body.mimeType,
      });
      res.status(201).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }
);

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
 *     responses:
 *       200:
 *         description: Document object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */
router.get(
  '/:id',
  requirePermission('documents:read'),
  validate(documentParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await getDocument(req.params.id as string, req.user!.id);
      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     summary: Soft-delete a document (sets deletedAt, preserves chunks)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Document soft-deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */
router.delete(
  '/:id',
  requirePermission('documents:delete'),
  validate(documentParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteDocument(req.params.id as string, req.user!.id);
      res.json({ success: true, data: { message: 'Document deleted' } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
