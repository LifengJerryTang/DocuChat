import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDatabase, createTestUser } from '../helpers/setup';

afterAll(async () => {
  await prisma.$disconnect();
});

// ── POST /api/v1/auth/register ────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns 201 and creates a user for valid input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'new@example.com', password: 'SecurePass1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe('new@example.com');
    // Password hash must NEVER appear in the response
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('returns 400 with VALIDATION_ERROR for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'SecurePass1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 CONFLICT for duplicate email', async () => {
    await createTestUser({ email: 'taken@example.com' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'taken@example.com', password: 'SecurePass1' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await resetDatabase();
    await createTestUser({ email: 'user@example.com' });
  });

  it('returns 200 with accessToken and refreshToken for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'TestPassword1!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('returns 401 UNAUTHORIZED for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials');
  });

  it('returns 401 UNAUTHORIZED for non-existent email (same message as wrong password)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Whatever1' });

    expect(res.status).toBe(401);
    // SECURITY: must be identical to wrong password error — prevents user enumeration
    expect(res.body.error.message).toBe('Invalid credentials');
  });
});

// ── Protected routes ──────────────────────────────────────────────────────────

describe('Protected routes', () => {
  let accessToken: string;

  beforeEach(async () => {
    await resetDatabase();
    await createTestUser({ email: 'user@example.com' });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'TestPassword1!' });
    accessToken = login.body.accessToken;
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/documents');
    expect(res.status).toBe(401);
  });

  it('returns 200 when a valid Bearer token is provided', async () => {
    const res = await request(app)
      .get('/api/v1/documents')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/v1/documents')
      .set('Authorization', 'Bearer this.is.not.a.valid.token');
    expect(res.status).toBe(401);
  });
});
