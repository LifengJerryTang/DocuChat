import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../lib/tokens';
import { appEvents } from '../lib/events';
import { AUTH_EVENTS } from '../events/auth.events';
import crypto from 'crypto';

export async function register(data: { email: string; password: string }) {

    const existing = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
        throw new Error('Email already registered');
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
        data: {
            email: data.email.toLowerCase().trim(),
            passwordHash,
        },
    });

    appEvents.emit(AUTH_EVENTS.USER_REGISTERED, {
        id: user.id,
        email: user.email,
        tier: user.tier,
    });

    // Never return the hash — only return safe fields
    return { id: user.id, email: user.email, tier: user.tier };
}

export async function login(data: {
  email: string;
  password: string;
  deviceInfo?: string;
}) {

    const user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase().trim() },
    });

    // IMPORTANT: same error for wrong email AND wrong password
    // This prevents "user enumeration" — attackers fishing for valid emails
    if (!user || !user.isActive) {
        appEvents.emit(AUTH_EVENTS.LOGIN_FAILED, {
            email: data.email,
            deviceInfo: data.deviceInfo,
            reason: 'user_not_found', 
        });
        throw new Error('Invalid credentials');
    }

    const valid = await verifyPassword(data.password, user.passwordHash);

    if (!valid) {
        appEvents.emit(AUTH_EVENTS.LOGIN_FAILED, {
            email: data.email,
            deviceInfo: data.deviceInfo,
            reason: 'wrong_password', 
        });
        throw new Error('Invalid credentials');
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store a SHA-256 hash of the refresh token — never the raw token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.refreshToken.create({
        data: {
        userId: user.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
    });

    appEvents.emit(AUTH_EVENTS.USER_LOGGED_IN, {
        userId: user.id,
        deviceInfo: data.deviceInfo,
    });

    return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, tier: user.tier },
    };
}

export async function refresh(rawRefreshToken: string) {
    let payload;

    try {
        payload = verifyRefreshToken(rawRefreshToken);
    } catch {
        throw new Error('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
    }

    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const stored = await prisma.refreshToken.findUnique({
        where: { token: tokenHash },
    });

    if (!stored || stored.expiresAt < new Date()) {
        throw new Error('Refresh token expired or revoked');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
    }

    // Rotation: delete the old token, issue a new one
    await prisma.refreshToken.delete({ where: { token: tokenHash } });


    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    await prisma.refreshToken.create({
        data: {
        userId: user.id,
        token: newHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(rawRefreshToken: string) {
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // deleteMany instead of delete — won't throw if the token doesn't exist
  await prisma.refreshToken.deleteMany({
    where: { token: tokenHash },
  });
}