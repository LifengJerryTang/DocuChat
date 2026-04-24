/**
 * Document domain event listeners.
 *
 * Why events instead of writing logs directly in the service?
 * - Services stay focused on business logic only
 * - A logging failure won't bubble up as a 500 to the user
 * - Adding new side effects (Slack alerts, analytics) only needs a new listener
 *
 * Imported once in app.ts to register all listeners at startup.
 */
import { appEvents } from '../lib/events';
import { prisma } from '../lib/prisma';
import { DOC_EVENTS } from '../services/document.service';

appEvents.on(DOC_EVENTS.CREATED, async (data: {
  userId: string;
  documentId: string;
  title: string;
  fileSizeBytes: number | null;
}) => {
  try {
    await prisma.usageLog.create({
      data: {
        userId: data.userId,
        action: 'document_created',
        tokens: 0,
        costUsd: 0,
        metadata: JSON.stringify({
          documentId: data.documentId,
          title: data.title,
          fileSizeBytes: data.fileSizeBytes,
        }),
      },
    });
  } catch (error) {
    console.error('Failed to log document creation:', error);
  }
});

appEvents.on(DOC_EVENTS.DELETED, async (data: {
  deletedBy: string;
  documentId: string;
  title: string;
}) => {
  try {
    await prisma.usageLog.create({
      data: {
        userId: data.deletedBy,
        action: 'document_deleted',
        tokens: 0,
        costUsd: 0,
        metadata: JSON.stringify({
          documentId: data.documentId,
          title: data.title,
          deletedAt: new Date().toISOString(),
        }),
      },
    });
  } catch (error) {
    console.error('Failed to log document deletion:', error);
  }
});
