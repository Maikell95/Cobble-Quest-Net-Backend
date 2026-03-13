import { Router, Request, Response } from 'express';
import { requireAdmin, type AuthRequest } from '../middleware/auth.js';
import * as StoreModel from '../models/store.model.js';
import type { CreateStoreItemDTO, UpdateStoreItemDTO, StoreCategory } from '../types/index.js';

const router = Router();

const VALID_CATEGORIES: StoreCategory[] = ['keys', 'breeding', 'battlepass', 'extras'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strip HTML tags to prevent stored XSS */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

// ---- Public ----

/** GET /api/store — active items only */
router.get('/', async (_req: Request, res: Response) => {
  const items = await StoreModel.getActiveItems();
  res.json({ success: true, data: items });
});

/** GET /api/store/:id */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(400).json({ success: false, message: 'ID inválido' });
    return;
  }
  const item = await StoreModel.getItemById(req.params.id);
  if (!item) {
    res.status(404).json({ success: false, message: 'Artículo no encontrado' });
    return;
  }
  res.json({ success: true, data: item });
});

// ---- Admin ----

/** GET /api/store/admin/all — all items (including inactive) */
router.get('/admin/all', requireAdmin, async (_req: AuthRequest, res: Response) => {
  const items = await StoreModel.getAllItems();
  res.json({ success: true, data: items });
});

/** POST /api/store */
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const body = req.body as CreateStoreItemDTO;

  if (!body.name?.trim() || !body.price || !body.category) {
    res.status(400).json({ success: false, message: 'Nombre, precio y categoría son requeridos' });
    return;
  }

  if (typeof body.name !== 'string' || body.name.length > 200) {
    res.status(400).json({ success: false, message: 'Nombre de artículo inválido' });
    return;
  }

  if (body.description && (typeof body.description !== 'string' || body.description.length > 2000)) {
    res.status(400).json({ success: false, message: 'Descripción demasiado larga' });
    return;
  }

  // Sanitize text fields
  body.name = stripHtml(body.name);
  if (body.description) body.description = stripHtml(body.description);

  if (!VALID_CATEGORIES.includes(body.category)) {
    res.status(400).json({ success: false, message: 'Categoría inválida' });
    return;
  }

  if (body.price < 0) {
    res.status(400).json({ success: false, message: 'El precio no puede ser negativo' });
    return;
  }

  if (body.commands && !Array.isArray(body.commands)) {
    res.status(400).json({ success: false, message: 'Los comandos deben ser un array de strings' });
    return;
  }

  if (body.commands) {
    for (const cmd of body.commands) {
      if (typeof cmd !== 'string' || !cmd.trim() || cmd.length > 500) {
        res.status(400).json({ success: false, message: 'Comando inválido. Máx 500 caracteres.' });
        return;
      }
    }
    if (body.commands.length > 20) {
      res.status(400).json({ success: false, message: 'Máximo 20 comandos por artículo.' });
      return;
    }
  }

  const item = await StoreModel.createItem(body);
  res.status(201).json({ success: true, data: item });
});

/** PUT /api/store/:id */
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const body = req.body as UpdateStoreItemDTO;
  const { id } = req.params as { id: string };

  if (!UUID_RE.test(id)) {
    res.status(400).json({ success: false, message: 'ID inválido' });
    return;
  }

  if (body.category && !VALID_CATEGORIES.includes(body.category)) {
    res.status(400).json({ success: false, message: 'Categoría inválida' });
    return;
  }

  if (body.price !== undefined && body.price < 0) {
    res.status(400).json({ success: false, message: 'El precio no puede ser negativo' });
    return;
  }

  if (body.commands !== undefined) {
    if (!Array.isArray(body.commands)) {
      res.status(400).json({ success: false, message: 'Los comandos deben ser un array de strings' });
      return;
    }
    for (const cmd of body.commands) {
      if (typeof cmd !== 'string' || !cmd.trim() || cmd.length > 500) {
        res.status(400).json({ success: false, message: 'Comando inválido. Máx 500 caracteres.' });
        return;
      }
    }
    if (body.commands.length > 20) {
      res.status(400).json({ success: false, message: 'Máximo 20 comandos por artículo.' });
      return;
    }
  }

  const item = await StoreModel.updateItem(id, body);
  if (!item) {
    res.status(404).json({ success: false, message: 'Artículo no encontrado' });
    return;
  }
  res.json({ success: true, data: item });
});

/** DELETE /api/store/:id */
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };

  if (!UUID_RE.test(id)) {
    res.status(400).json({ success: false, message: 'ID inválido' });
    return;
  }
  const deleted = await StoreModel.deleteItem(id);
  if (!deleted) {
    res.status(404).json({ success: false, message: 'Artículo no encontrado' });
    return;
  }
  res.json({ success: true, message: 'Artículo eliminado' });
});

export default router;
