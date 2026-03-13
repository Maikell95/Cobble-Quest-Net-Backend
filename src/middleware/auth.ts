import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { verifyCredentials } from '../models/admin.model.js';

export interface AuthPayload {
  id: string;
  username: string;
  role: 'admin';
}

export interface AuthRequest extends Request {
  admin?: AuthPayload;
}

const TOKEN_EXPIRY = '8h';

/**
 * Verify JWT and attach admin payload to request.
 * Expects header: Authorization: Bearer <jwt>
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Token requerido' });
    return;
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    if (decoded.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Acceso denegado' });
      return;
    }
    req.admin = decoded;
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Token expirado'
      : 'Token inválido';
    res.status(401).json({ success: false, message });
  }
}

/** Validate credentials against the database and return a signed JWT, or null. */
export async function generateAdminToken(username: string, password: string): Promise<string | null> {
  const user = await verifyCredentials(username, password);
  if (!user) return null;

  return jwt.sign(
    { id: user.id, username: user.username, role: 'admin' } satisfies AuthPayload,
    env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
}

/** Issue a fresh JWT for an already-authenticated admin (resets expiry clock). */
export function refreshAdminToken(payload: AuthPayload): string {
  return jwt.sign(
    { id: payload.id, username: payload.username, role: 'admin' } satisfies AuthPayload,
    env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
}

/** Decode a valid JWT without throwing (for /me endpoint). */
export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}
