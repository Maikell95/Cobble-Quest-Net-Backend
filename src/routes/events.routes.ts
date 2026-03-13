import { Router, Request, Response } from 'express';
import { requireAdmin, type AuthRequest } from '../middleware/auth.js';
import * as EventModel from '../models/event.model.js';
import type { CreateEventDTO, UpdateEventDTO, EventTag } from '../types/index.js';

const router = Router();

const VALID_TAGS: EventTag[] = ['pvp', 'capture', 'exploration', 'tournament', 'seasonal', 'special'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strip HTML tags to prevent stored XSS */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

// ---- Public ----

/** GET /api/events — active events only */
router.get('/', async (_req: Request, res: Response) => {
  const events = await EventModel.getActiveEvents();
  res.json({ success: true, data: events });
});

/** GET /api/events/:id */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(400).json({ success: false, message: 'ID inválido' });
    return;
  }
  const event = await EventModel.getEventById(req.params.id);
  if (!event) {
    res.status(404).json({ success: false, message: 'Evento no encontrado' });
    return;
  }
  res.json({ success: true, data: event });
});

// ---- Admin ----

/** GET /api/events/admin/all — all events (including inactive) */
router.get('/admin/all', requireAdmin, async (_req: AuthRequest, res: Response) => {
  const events = await EventModel.getAllEvents();
  res.json({ success: true, data: events });
});

/** POST /api/events */
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const body = req.body as CreateEventDTO;

  if (!body.title?.trim() || typeof body.title !== 'string' || body.title.length > 200) {
    res.status(400).json({ success: false, message: 'Título es requerido (máx 200 caracteres)' });
    return;
  }

  if (body.description && (typeof body.description !== 'string' || body.description.length > 5000)) {
    res.status(400).json({ success: false, message: 'Descripción demasiado larga' });
    return;
  }

  // Sanitize text fields
  body.title = stripHtml(body.title);
  if (body.description) body.description = stripHtml(body.description);

  if (body.tags?.length) {
    const invalid = body.tags.filter((t) => !VALID_TAGS.includes(t));
    if (invalid.length) {
      res.status(400).json({ success: false, message: `Tags inválidos: ${invalid.join(', ')}` });
      return;
    }
  }

  const event = await EventModel.createEvent({
    ...body,
    tags: body.tags || [],
  });
  res.status(201).json({ success: true, data: event });
});

/** PUT /api/events/:id */
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const body = req.body as UpdateEventDTO;
  const { id } = req.params as { id: string };

  if (!UUID_RE.test(id)) {
    res.status(400).json({ success: false, message: 'ID inválido' });
    return;
  }

  if (body.tags?.length) {
    const invalid = body.tags.filter((t) => !VALID_TAGS.includes(t));
    if (invalid.length) {
      res.status(400).json({ success: false, message: `Tags inválidos: ${invalid.join(', ')}` });
      return;
    }
  }

  const event = await EventModel.updateEvent(id, body);
  if (!event) {
    res.status(404).json({ success: false, message: 'Evento no encontrado' });
    return;
  }
  res.json({ success: true, data: event });
});

/** DELETE /api/events/:id */
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };

  if (!UUID_RE.test(id)) {
    res.status(400).json({ success: false, message: 'ID inválido' });
    return;
  }
  const deleted = await EventModel.deleteEvent(id);
  if (!deleted) {
    res.status(404).json({ success: false, message: 'Evento no encontrado' });
    return;
  }
  res.json({ success: true, message: 'Evento eliminado' });
});

export default router;
