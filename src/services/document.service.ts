import { prisma } from '../lib/prisma';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { appEvents } from '../lib/events';
import { queueDocumentForProcessing } from '../queues/document.queue';


// ── Event constants ────────────────────────────────────────────────────────────
export const DOC_EVENTS = {
  CREATED: 'doc:created',
  DELETED: 'doc:deleted',
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ListDocumentsOptions {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy?: 'createdAt' | 'title' | 'chunkCount';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateDocumentData {
  userId: string;
  title: string;
  content: string;
  mimeType?: string;
}

// ── listDocuments ──────────────────────────────────────────────────────────────
/**
 * Returns a paginated, filterable, sortable list of non-deleted documents
 * for a given user.
 *
 * Uses Promise.all to run the list query and count query in parallel — no
 * reason to wait for one to finish before starting the other.
 */
export async function listDocuments(userId: string, options: ListDocumentsOptions) {
  const { page, limit, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;

  // Build the where clause dynamically.
  // Prisma ignores undefined values, so we only add fields when they have a value.
  const where: Record<string, unknown> = {
    userId,
    deletedAt: null, // soft-delete filter — only return active documents
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    // Case-insensitive title search.
    // In SQLite, 'contains' is case-insensitive by default.
    // In PostgreSQL, you'd add: mode: 'insensitive'
    where.title = { contains: search };
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      // select only what the list view needs — avoids sending 50KB of
      // document content for every row in the list
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

  return {
    data: documents,
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// ── getDocument ────────────────────────────────────────────────────────────────
/**
 * Fetches a single document by ID.
 * Throws NotFoundError if the document doesn't exist, is soft-deleted,
 * or belongs to a different user.
 *
 * Note: We return the same error for "not found" and "wrong user" to
 * avoid leaking information about what documents exist.
 */
export async function getDocument(documentId: string, userId: string) {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
    },
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  return document;
}

// ── createDocument ─────────────────────────────────────────────────────────────
/**
 * Creates a new document in "pending" status and emits doc:created for
 * async processing (chunking happens in Week 3 when BullMQ is set up).
 */
export async function createDocument(data: CreateDocumentData) {
  const { userId, title, content, mimeType } = data;

  const document = await prisma.document.create({
    data: {
      userId,
      title,
      filename: title.toLowerCase().replace(/\s+/g, '-') + '.txt',
      content,
      mimeType,
      fileSizeBytes: Buffer.byteLength(content, 'utf8'),
      status: 'pending',
    },
  });

  // Queue for background processing BEFORE emitting the event.
  // If queueing fails, we bubble the error up — no point emitting
  // "doc:created" if the processing job was never registered.
  const jobId = await queueDocumentForProcessing(document.id, userId);

  // Emit audit event only after the queue call succeeds.
  appEvents.emit(DOC_EVENTS.CREATED, {
    userId,
    documentId: document.id,
    title: document.title,
    fileSizeBytes: document.fileSizeBytes,
  });

  return { document, jobId };
}

// ── deleteDocument ─────────────────────────────────────────────────────────────
/**
 * Soft-deletes a document by setting deletedAt and deletedBy.
 * The row stays in the database — chunks are preserved for potential restore.
 *
 * Why soft delete instead of hard delete?
 * - Users may accidentally delete documents and want them back
 * - Admins may need to audit deleted content
 * - Permanent purge is a background maintenance job, not a user action
 *
 * Why same error for "not found" and "wrong owner"?
 * - Prevents enumeration: an attacker can't distinguish "doesn't exist"
 *   from "exists but belongs to someone else"
 */
export async function deleteDocument(documentId: string, userId: string) {
  // First fetch to verify existence and ownership
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      deletedAt: null, // already-deleted documents are "not found"
    },
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  const deleted = await prisma.document.update({
    where: { id: documentId },
    data: {
      deletedAt: new Date(),
      deletedBy: userId,
    },
  });

  appEvents.emit(DOC_EVENTS.DELETED, {
    deletedBy: userId,
    documentId: deleted.id,
    title: deleted.title,
  });

  return deleted;
}
