import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '../auth.service';
import { prisma } from '../../lib/prisma';
import { ConflictError, UnauthorizedError } from '../../lib/errors';

// Mock the entire Prisma client — no real database needed
vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
    },
    userRole: {
      create: vi.fn(),
    },
  },
}));

// Mock events so they don't fire real listeners
vi.mock('../../lib/events', () => ({
  appEvents: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Prevent auth.events.ts from registering DB-writing listeners at import time
vi.mock('../../events/auth.events', () => ({
  AUTH_EVENTS: {
    USER_REGISTERED: 'USER_REGISTERED',
    USER_LOGGED_IN: 'USER_LOGGED_IN',
    LOGIN_FAILED: 'LOGIN_FAILED',
  },
}));

// ── register ──────────────────────────────────────────────────────────────────

describe('auth.service.register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a user and returns safe fields (no passwordHash)', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      tier: 'free',
      passwordHash: '$2b$12$hashedvalue',
    });

    const result = await authService.register({
      email: 'test@example.com',
      password: 'SecurePass1',
    });

    // Should call create with a bcrypt hash, not the raw password
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        passwordHash: expect.stringMatching(/^\$2[aby]\$/),
      }),
    });

    // Never leak the password hash in the response
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('email');
  });

  it('throws ConflictError if email is already registered', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing-user' });

    await expect(
      authService.register({ email: 'taken@example.com', password: 'SecurePass1' })
    ).rejects.toThrow(ConflictError);

    await expect(
      authService.register({ email: 'taken@example.com', password: 'SecurePass1' })
    ).rejects.toThrow('Email already registered');
  });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('auth.service.login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns accessToken, refreshToken, and safe user fields for valid credentials', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('SecurePass1', 12);

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      tier: 'free',
      isActive: true,
      passwordHash: hash,
    });
    (prisma.refreshToken.create as any).mockResolvedValue({});

    const result = await authService.login({
      email: 'test@example.com',
      password: 'SecurePass1',
    });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe('test@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('throws UnauthorizedError for wrong password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('RealPassword1', 12);

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      isActive: true,
      passwordHash: hash,
    });

    await expect(
      authService.login({ email: 'test@example.com', password: 'WrongPassword1' })
    ).rejects.toThrow(UnauthorizedError);
  });

  // SECURITY TEST: wrong email and wrong password must return the same error
  // message — prevents attackers from using error differences to enumerate users
  it('throws the same error message for non-existent email as for wrong password', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const error = await authService
      .login({ email: 'nobody@example.com', password: 'Whatever1' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toBe('Invalid credentials');
  });
});
