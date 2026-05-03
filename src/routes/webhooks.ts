import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/example', async (req: Request, res: Response) => {
  // Body is still raw bytes here — parse it manually
  const event = JSON.parse((req as any).rawBody.toString());

  // Idempotency check — has this event ID been fully processed before?
  const existing = await prisma.webhookEvent.findUnique({
    where: { id: event.id },
  });

  if (existing?.processedAt) {
    return res.json({ received: true, duplicate: true });
  }

  // Record receipt. The unique primary key prevents a second concurrent
  // delivery from inserting the same row.
  await prisma.webhookEvent.upsert({
    where: { id: event.id },
    update: {},
    create: {
      id: event.id,
      provider: 'example',
      eventType: event.type,
      payload: JSON.stringify(event),
    },
  });

  // Acknowledge FAST — before processing starts
  res.status(202).json({ received: true });

  // Process async — after 202 is already sent
  try {
    await processWebhookEvent(event);
    // Only mark processed after work succeeds
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    console.error(`Webhook ${event.id} processing failed:`, error);
    // processedAt stays null — next delivery will try again
  }
});

async function processWebhookEvent(event: any) {
  switch (event.type) {
    case 'document.imported':
      // Queue document processing (Week 4)
      break;
    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
  }
}

export default router;
