// Day 2 — Seed Script
// TODO: Implement the seed script
// Reference: Lesson 2.4 — Migration Systems with Prisma
//
// Requirements:
//   - Import PrismaClient and bcryptjs
//   - Create 2 users (admin + test user) using upsert (not create)
//   - Hash passwords with bcrypt (never store plaintext, even in seeds)
//   - Create 1 sample document for the test user
//   - Call prisma.$disconnect() on success and failure

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  // Admin user — enterprise tier, high token limit
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@docuchat.dev' },
    update: {},
    create: {
      email: 'admin@docuchat.dev',
      passwordHash: adminHash,
      tier: 'enterprise',
      tokenLimit: 1000000,
    },
  });

  // Regular test user — free tier, default limits
  const userHash = await bcrypt.hash('Test1234!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'test@docuchat.dev' },
    update: {},
    create: {
      email: 'test@docuchat.dev',
      passwordHash: userHash,
    },
  });

  // A sample document for the test user
  await prisma.document.create({
    data: {
      userId: user.id,
      title: 'Getting Started with DocuChat',
      filename: 'getting-started.txt',
      content: 'Welcome to DocuChat. This is a sample document.',
      status: 'ready',
      chunkCount: 1,
    },
  });

  console.log('Done. admin:', admin.email, '| user:', user.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });