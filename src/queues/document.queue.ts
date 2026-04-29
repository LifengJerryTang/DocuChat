import { Queue } from 'bullmq';
import { redisConnection } from './connection';

export const documentQueue = new Queue('document-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,   // 2s → 4s → 8s
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function queueDocumentForProcessing(
  documentId: string,
  userId: string
): Promise<string> {
  const job = await documentQueue.add(
    'process-document',
    { documentId, userId, queuedAt: Date.now() },
  );
  return job.id!;
}