import { Worker, Job } from 'bullmq';
import { redisConnection } from './connection';
import { deadLetterQueue } from './dead-letter-queue';
import { prisma } from '../lib/prisma';
import { appEvents } from '../lib/events';
import { splitIntoChunks, estimateTokens } from '../lib/chunker';

const worker = new Worker(
  'document-processing',
  async (job: Job) => {
    const { documentId, userId } = job.data;
    console.log(`Processing document ${documentId} (attempt ${job.attemptsMade + 1})`);

    // Step 1: Fetch document — throws if not found
    const doc = await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
    });

    // Step 2: Mark as processing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });
    await job.updateProgress(10);

    try {
      // Step 3: Split into chunks
      const chunks = splitIntoChunks(doc.content, 500);
      await job.updateProgress(40);

      // Step 4: Store chunks atomically
      await prisma.$transaction(async (tx) => {
        // Delete existing chunks first — makes the operation idempotent on retry
        await tx.chunk.deleteMany({ where: { documentId } });

        await tx.chunk.createMany({
          data: chunks.map((text, index) => ({
            documentId,
            index,
            content: text,
            tokenCount: estimateTokens(text),
          })),
        });

        await tx.document.update({
          where: { id: documentId },
          data: { status: 'ready', chunkCount: chunks.length },
        });
      });
      await job.updateProgress(100);

      // Step 5: Emit audit event
      appEvents.emit('doc:processed', { documentId, userId, chunkCount: chunks.length });

      return { success: true, chunks: chunks.length };

    } catch (error) {
      // Only mark failed on the LAST attempt — still retrying otherwise
      if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'failed', error: (error as Error).message },
        });
      }
      throw error; // re-throw so BullMQ retries
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// Logging
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed: ${job.returnvalue?.chunks} chunks`);
});

worker.on('failed', async (job, error) => {
  console.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, error.message);

  // Move permanently failed jobs to the dead letter queue
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await deadLetterQueue.add('failed-document', {
      originalJobId: job.id,
      originalQueue: 'document-processing',
      data: job.data,
      error: error.message,
      failedAt: new Date().toISOString(),
      attempts: job.attemptsMade,
    });
  }
});

worker.on('error', (error) => {
  console.error('Worker error:', error);
});

export { worker };
