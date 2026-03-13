import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const errorId = crypto.randomUUID().slice(0, 8);
  console.error(`[ERROR ${errorId}] ${err.message}`);

  // Never expose internal error details to the client
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    errorId, // so user can report to support
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
}
