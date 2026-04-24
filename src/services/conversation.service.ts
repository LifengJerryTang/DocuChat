import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ListConversationsOptions {
  page: number;
  limit: number;
}

export interface CreateConversationData {
  userId: string;
  title?: string;
  documentId?: string;
}

export interface SendMessageData {
  conversationId: string;
  userId: string;
  content: string;
  documentId?: string;
}

// ── listConversations ──────────────────────────────────────────────────────────
/**
 * Returns paginated conversations enriched with:
 *   - lastMessage: latest message preview (content, role, createdAt)
 *   - messageCount: total messages without loading them all
 *
 * Both fetched in ONE query via include — no N+1 loop.
 * List + count run in parallel via Promise.all.
 */
export async function listConversations(userId: string, options: ListConversationsOptions) {
  const { page, limit } = options;

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        // take: 1 means only the latest message — avoids loading ALL messages
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            content: true,
            role: true,
            createdAt: true,
          },
        },
        // _count gives total count without loading rows into memory
        _count: {
          select: { messages: true },
        },
      },
    }),
    prisma.conversation.count({ where: { userId } }),
  ]);

  return {
    data: conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      messageCount: conv._count.messages,
      lastMessage: conv.messages[0] ?? null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    })),
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// ── createConversation ─────────────────────────────────────────────────────────
/**
 * Creates a conversation optionally tied to a document.
 * Verifies document ownership before creating (prevents referencing other users' docs).
 */
export async function createConversation(data: CreateConversationData) {
  const { userId, title, documentId } = data;

  if (documentId) {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId, deletedAt: null },
    });
    if (!doc) {
      throw new NotFoundError('Document not found');
    }
  }

  return prisma.conversation.create({
    data: { userId, title: title ?? null },
  });
}

// ── sendMessage ────────────────────────────────────────────────────────────────
/**
 * Creates a user message + assistant placeholder in a single transaction.
 *
 * Why a transaction? Five operations must all succeed or all roll back:
 *   1. Verify conversation ownership
 *   2. Create user message
 *   3. Touch conversation.updatedAt (so it floats to top of list)
 *   4. Create assistant placeholder (Week 4 replaces with real RAG response)
 *   5. Log usage
 *
 * All Prisma calls use `tx` — the transactional client — not the global
 * `prisma`. Queries through `prisma` bypass the transaction and won't roll back.
 */
export async function sendMessage(data: SendMessageData) {
  const { conversationId, userId, content, documentId } = data;

  return prisma.$transaction(async (tx) => {
    // Step 1: Ownership check inside the transaction
    const conversation = await tx.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Verify the referenced document is active and owned by this user
    if (documentId) {
      const doc = await tx.document.findFirst({
        where: { id: documentId, userId, deletedAt: null },
      });
      if (!doc) {
        throw new NotFoundError('Document not found');
      }
    }

    // Step 2: User message
    const userMessage = await tx.message.create({
      data: {
        conversationId,
        documentId: documentId ?? null,
        role: 'user',
        content,
      },
    });

    // Step 3: Touch updatedAt so this conversation sorts to the top
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Step 4: Placeholder — Week 4 replaces with RAG pipeline output
    const assistantMessage = await tx.message.create({
      data: {
        conversationId,
        documentId: documentId ?? null,
        role: 'assistant',
        content: 'RAG pipeline not yet implemented. Check back in Week 4!',
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        latencyMs: 0,
      },
    });

    // Step 5: Usage log — real token counts come in Week 4
    await tx.usageLog.create({
      data: {
        userId,
        action: 'chat',
        tokens: 0,
        costUsd: 0,
        metadata: JSON.stringify({ conversationId, documentId }),
      },
    });

    return { userMessage, assistantMessage };
  });
}

// ── getMessages ────────────────────────────────────────────────────────────────
/**
 * Paginated messages for a conversation (oldest-first for chat display).
 * Verifies the conversation belongs to the requesting user.
 */
export async function getMessages(
  conversationId: string,
  userId: string,
  options: { page: number; limit: number }
) {
  const { page, limit } = options;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
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
    prisma.message.count({ where: { conversationId } }),
  ]);

  return {
    data: messages,
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
