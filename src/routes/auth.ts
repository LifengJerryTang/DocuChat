import { Router } from 'express';
import * as authService from '../services/auth.service';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from '../validators/auth.validator';


const router = Router();

// POST /api/auth/register
router.post('/register',  validate(registerSchema), async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ user });
  } catch (error) {
    next(error); // pass to Express error handler
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login({
      ...req.body,
      deviceInfo: req.headers['user-agent'], // capture browser/device info
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await authService.refresh(req.body.refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', validate(logoutSchema), async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

export default router;
