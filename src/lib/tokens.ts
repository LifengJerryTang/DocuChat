import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

interface TokenPayload {
  sub: string;        
  role: string;       
  type: 'access' | 'refresh';
}

export function generateAccessToken(user: { id: string; tier: string }) {
  return jwt.sign(
    { sub: user.id, role: user.tier, type: 'access' },
    ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

export function generateRefreshToken(user: { id: string; tier: string }) {
  return jwt.sign(
    { sub: user.id, role: user.tier, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}