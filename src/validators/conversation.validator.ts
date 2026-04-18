import { z } from 'zod';

export const createConversationSchema = z.object({
  body: z.object({
    title: z.string().max(200, 'Title too long').optional(),
    documentId: z.uuid('Invalid document ID').optional(),
  }),
});

export const conversationParamsSchema = z.object({
  params: z.object({
    id: z.uuid('Invalid conversation ID'),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({
    id: z.uuid('Invalid conversation ID'),
  }),
  body: z.object({
    content: z.string()
      .min(1, 'Message cannot be empty')
      .max(10000, 'Message too long'),
    documentId: z.uuid('Invalid document ID').optional(),
  }),
});

export const listMessagesSchema = z.object({
  params: z.object({
    id: z.uuid('Invalid conversation ID'),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});
