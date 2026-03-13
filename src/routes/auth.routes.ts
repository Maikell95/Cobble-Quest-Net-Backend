import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { generateAdminToken, refreshAdminToken, requireAdmin, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// Strict limiter for login: 5 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Intenta en 15 minutos.' },
});

/** POST /api/auth/login */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
    return;
  }

  if (username.length > 64 || password.length > 128) {
    res.status(400).json({ success: false, message: 'Credenciales inválidas' });
    return;
  }

  const token = await generateAdminToken(username.trim(), password);
  if (!token) {
    res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    return;
  }

  res.json({ success: true, data: { token } });
});

/** GET /api/auth/me — verify token & return current admin */
router.get('/me', requireAdmin, (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: req.admin });
});

/** POST /api/auth/refresh — issue a new JWT with fresh expiry */
router.post('/refresh', requireAdmin, (req: AuthRequest, res: Response) => {
  const newToken = refreshAdminToken(req.admin!);
  res.json({ success: true, data: { token: newToken } });
});

export default router;
