import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getOnlinePlayersSnapshot,
  isClientApiConfigured,
  isPelicanConfigured,
  sendServerCommand,
} from '../config/pelican.js';
import env from '../config/env.js';

const router = Router();

// Rate limiter: 30 verify requests per 15 min per IP
const playerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, error: 'Demasiadas solicitudes. Intenta más tarde.' },
});

/**
 * GET /api/player/online
 * Returns online players from Velocity via glist command + log parsing.
 */
router.get('/online', playerLimiter, async (_req: Request, res: Response) => {
  if (!isClientApiConfigured()) {
    res.status(503).json({
      ok: false,
      error: 'Pelican Client API no está configurada.',
    });
    return;
  }

  const velocityId = env.PELICAN_VELOCITY_SERVER_ID;
  if (!velocityId) {
    res.status(503).json({ ok: false, error: 'Velocity server no está configurado.' });
    return;
  }

  try {
    const snapshot = await getOnlinePlayersSnapshot(velocityId, 'Velocity');

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      servers: [snapshot],
      summary: {
        totalServersChecked: 1,
        totalUniquePlayers: snapshot.onlineCount,
        uniquePlayers: snapshot.players,
      },
    });
  } catch (err) {
    console.error('Online players query failed:', err);
    res.status(502).json({
      ok: false,
      error: 'No se pudo consultar jugadores online.',
    });
  }
});

/**
 * Check if a player is currently online via Velocity's glist.
 */
async function checkOnlineStatus(username: string): Promise<{ online: boolean; server: string | null }> {
  const velocityId = env.PELICAN_VELOCITY_SERVER_ID;
  if (!isClientApiConfigured() || !velocityId) {
    return { online: false, server: null };
  }
  try {
    const snapshot = await getOnlinePlayersSnapshot(velocityId, 'Velocity');
    const target = username.toLowerCase();
    const found = snapshot.players.find(p => p.toLowerCase() === target);
    return found ? { online: true, server: null } : { online: false, server: null };
  } catch {
    return { online: false, server: null };
  }
}

/**
 * GET /api/player/verify/:username?premium=true|false
 * 1. Validates username format
 * 2. If premium, verifies via Mojang API
 * 3. Checks if player is currently online on the server
 * 4. Returns player info (avatar, uuid, online status)
 */
router.get('/verify/:username', playerLimiter, async (req: Request<{ username: string }>, res: Response) => {
  const { username } = req.params;
  const premium = req.query.premium !== 'false';

  // Basic validation: 3-16 chars, alphanumeric + underscore
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    res.status(400).json({
      valid: false,
      error: 'Nombre inválido. Debe tener 3-16 caracteres (letras, números, _).',
    });
    return;
  }

  // Non-premium: accept username without Mojang verification
  if (!premium) {
    const { online } = await checkOnlineStatus(username);
    if (!online) {
      res.status(403).json({
        valid: false,
        error: 'Debes estar conectado al servidor para verificar tu cuenta. Conéctate y vuelve a intentarlo.',
      });
      return;
    }
    res.json({
      valid: true,
      premium: false,
      username,
      uuid: null,
      avatar: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/64`,
      online: true,
    });
    return;
  }

  // Premium: verify with Mojang
  try {
    const mojangRes = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    );

    if (mojangRes.status === 404 || mojangRes.status === 204) {
      res.status(404).json({
        valid: false,
        error: 'No se encontró una cuenta premium de Minecraft con ese nombre.',
      });
      return;
    }

    if (!mojangRes.ok) {
      res.status(502).json({
        valid: false,
        error: 'Error al consultar los servidores de Mojang. Inténtalo más tarde.',
      });
      return;
    }

    const data = (await mojangRes.json()) as { id: string; name: string };

    const uuid = data.id.replace(
      /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
      '$1-$2-$3-$4-$5',
    );

    const { online } = await checkOnlineStatus(data.name);
    if (!online) {
      res.status(403).json({
        valid: false,
        error: 'Debes estar conectado al servidor para verificar tu cuenta. Conéctate y vuelve a intentarlo.',
      });
      return;
    }

    res.json({
      valid: true,
      premium: true,
      username: data.name,
      uuid,
      avatar: `https://mc-heads.net/avatar/${data.id}/64`,
      online: true,
    });
  } catch {
    res.status(502).json({
      valid: false,
      error: 'No se pudo conectar con los servidores de Mojang.',
    });
  }
});

export default router;
