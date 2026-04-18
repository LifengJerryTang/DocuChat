import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/tokens';

// Tell TypeScript that req.user exists on Express requests
declare global {
    namespace Express {
        interface Request {
            user?: { id: string; role: string };
        }
    }
}


export function authenticate(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // "Bearer eyJhbG..." → we want just "eyJhbG..."
    const token = header.split(' ')[1];

    try {
        const payload = verifyAccessToken(token);

        // Prevent refresh tokens from being used as access tokens
        if (payload.type !== 'access') {
        return res.status(401).json({ error: 'Invalid token type' });
        }

        // Attach user info to req — available to every handler after this
        req.user = { id: payload.sub, role: payload.role };
        next();

    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}