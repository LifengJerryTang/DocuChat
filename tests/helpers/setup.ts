import { prisma } from '../../src/lib/prisma';

/**
 * Resets all tables in FK-safe order before each test suite.
 * Always call this in beforeEach to ensure test isolation.
 */
export async function resetDatabase() {
  await prisma.usageLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Creates a test user with a pre-hashed password and assigns the default role.
 * Uses bcrypt rounds=4 for speed (not security — tests only).
 */
export async function createTestUser(overrides: Record<string, any> = {}) {
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash('TestPassword1!', 4); // Low rounds = fast tests

  const user = await prisma.user.create({
    data: {
      email: 'test@docuchat.dev',
      passwordHash: hash,
      ...overrides,
    },
  });

  // Assign the member role so requirePermission checks pass in integration tests
  const memberRole = await prisma.role.findUnique({ where: { name: 'member' } });
  if (memberRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: memberRole.id },
    });
  }

  return user;
}
