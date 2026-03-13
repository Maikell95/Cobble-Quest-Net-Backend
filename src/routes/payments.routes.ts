import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { paypalGateway } from '../config/paypal.js';
import { stripeGateway } from '../config/stripe.js';
import { isClientApiConfigured, sendCommand } from '../config/pelican.js';
import * as PaymentModel from '../models/payment.model.js';
import * as StoreModel from '../models/store.model.js';
import env from '../config/env.js';
import type { PaymentGateway, PaymentMethod, PaymentItem } from '../config/payment.types.js';

const router = Router();

// Rate limiter for payment creation: 10 per 15 min per IP
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes de pago. Intenta más tarde.' },
});

// ---- Gateway registry ----
const gateways: Record<PaymentMethod, PaymentGateway> = {
  paypal: paypalGateway,
  stripe: stripeGateway,
};

function getGateway(method: PaymentMethod): PaymentGateway | null {
  const gw = gateways[method];
  return gw?.isConfigured?.() ? gw : null;
}

// ---- Allowed command prefixes (whitelist) ----
const ALLOWED_COMMAND_PREFIXES = [
  'lp user',
  'give',
  'cobblemon give',
  'say',
  'title',
  'effect give',
  'kit',
];

function isCommandAllowed(cmd: string): boolean {
  const lower = cmd.toLowerCase().trim();
  return ALLOWED_COMMAND_PREFIXES.some(prefix => lower.startsWith(prefix));
}

// ---- Server-side rank definitions (source of truth for rank commands) ----
interface RankDefinition {
  name: string;
  monthlyPrice: number;
  permanentPrice: number;
  commands: string[];
}

const RANKS: Record<string, RankDefinition> = {
  super:  { name: 'Super',  monthlyPrice: 4.99,  permanentPrice: 14.99, commands: ['lp user {username} parent add super'] },
  ultra:  { name: 'Ultra',  monthlyPrice: 9.99,  permanentPrice: 29.99, commands: ['lp user {username} parent add ultra'] },
  honor:  { name: 'Honor',  monthlyPrice: 19.99, permanentPrice: 44.99, commands: ['lp user {username} parent add honor'] },
  luxury: { name: 'Luxury', monthlyPrice: 29.99, permanentPrice: 59.99, commands: ['lp user {username} parent add luxury'] },
  master: { name: 'Master', monthlyPrice: 34.99, permanentPrice: 74.99, commands: ['lp user {username} parent add master'] },
};

/** Match a payment item to a known rank by name + price. Returns rank commands if matched. */
function resolveRankCommands(item: PaymentItem): string[] | null {
  for (const rank of Object.values(RANKS)) {
    const nameMatch = item.name.toLowerCase().includes(rank.name.toLowerCase());
    const priceMatch = Math.abs(item.price - rank.monthlyPrice) < 0.01
                    || Math.abs(item.price - rank.permanentPrice) < 0.01;
    if (nameMatch && priceMatch) {
      return rank.commands;
    }
  }
  return null;
}

/**
 * Resolve trusted commands for each item in a payment.
 * - Store items: commands come from the DB (by storeItemId)
 * - Ranks: commands come from the server-side RANKS definition
 * - Unknown items: no commands (security — never trust frontend commands)
 */
async function resolveItemCommands(items: PaymentItem[]): Promise<string[]> {
  const allCommands: string[] = [];

  // Pre-fetch store items if any have storeItemId
  const hasStoreItems = items.some(i => i.storeItemId);
  let storeItems: Awaited<ReturnType<typeof StoreModel.getActiveItems>> = [];
  if (hasStoreItems) {
    try {
      storeItems = await StoreModel.getActiveItems();
    } catch {
      // If DB is down, we still try rank matching
    }
  }

  for (const item of items) {
    // 1. Store item — commands from DB
    if (item.storeItemId) {
      const dbItem = storeItems.find(si => si.id === item.storeItemId);
      if (dbItem?.commands?.length) {
        for (let q = 0; q < item.quantity; q++) {
          allCommands.push(...dbItem.commands);
        }
        continue;
      }
    }

    // 2. Rank — commands from server-side definitions
    const rankCmds = resolveRankCommands(item);
    if (rankCmds) {
      allCommands.push(...rankCmds);
      continue;
    }

    // 3. No match — skip
    console.warn(`No server-side commands found for item: "${item.name}" (storeItemId=${item.storeItemId ?? 'none'})`);
  }

  return allCommands;
}

/**
 * GET /api/payments/methods
 */
router.get('/methods', (_req: Request, res: Response) => {
  const methods: Array<{ id: PaymentMethod; name: string; available: boolean }> = [
    { id: 'paypal', name: 'PayPal', available: paypalGateway.isConfigured() },
    { id: 'stripe', name: 'Tarjeta de Crédito', available: stripeGateway.isConfigured() },
  ];
  res.json({ success: true, data: methods });
});

/**
 * POST /api/payments/create-order
 */
router.post('/create-order', paymentLimiter, async (req: Request, res: Response) => {
  const { username, items, method, inline } = req.body as {
    username?: string;
    items?: PaymentItem[];
    method?: PaymentMethod;
    inline?: boolean;
  };

  if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    res.status(400).json({ success: false, message: 'Nombre de jugador inválido.' });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
    res.status(400).json({ success: false, message: 'No hay artículos en la orden.' });
    return;
  }

  if (!method || !['paypal', 'stripe'].includes(method)) {
    res.status(400).json({ success: false, message: 'Método de pago inválido.' });
    return;
  }

  for (const item of items) {
    if (!item.name || typeof item.name !== 'string' || item.name.length > 200) {
      res.status(400).json({ success: false, message: 'Artículo inválido en la orden.' });
      return;
    }
    if (typeof item.price !== 'number' || item.price <= 0 || item.price > 10000) {
      res.status(400).json({ success: false, message: 'Precio de artículo inválido.' });
      return;
    }
    if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 100 || !Number.isInteger(item.quantity)) {
      res.status(400).json({ success: false, message: 'Cantidad de artículo inválida.' });
      return;
    }
  }

  // Server-side price verification for store items
  try {
    const storeItems = await StoreModel.getActiveItems();
    for (const item of items) {
      if (item.storeItemId) {
        const dbItem = storeItems.find(si => si.id === item.storeItemId);
        if (dbItem && Math.abs(dbItem.price - item.price) > 0.01) {
          res.status(400).json({ success: false, message: `Precio alterado para "${item.name}". Recarga la página.` });
          return;
        }
      }
    }
  } catch {
    // If store check fails, continue
  }

  // Server-side price verification for ranks
  for (const item of items) {
    if (!item.storeItemId) {
      const rankCmds = resolveRankCommands(item);
      if (!rankCmds) {
        res.status(400).json({ success: false, message: `Artículo no reconocido: "${item.name}".` });
        return;
      }
    }
  }

  const gateway = getGateway(method);
  if (!gateway) {
    res.status(503).json({ success: false, message: `El método de pago ${method} no está disponible.` });
    return;
  }

  try {
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const result = await gateway.createOrder({
      username,
      items,
      method,
      returnUrl: `${env.FRONTEND_URL}/cart?status=complete&method=${method}&orderId={orderId}`,
      cancelUrl: `${env.FRONTEND_URL}/cart?status=cancel`,
      inline: !!inline,
    });

    // Save payment record (items for reference, commands resolved server-side on capture)
    await PaymentModel.createPayment({
      providerOrderId: result.providerOrderId,
      method,
      username,
      items: JSON.stringify(items),
      amount: total,
      currency: 'USD',
      status: 'pending',
    });

    res.json({
      success: true,
      data: {
        orderId: result.orderId,
        approvalUrl: result.approvalUrl,
        method: result.method,
      },
    });
  } catch (err) {
    console.error(`Payment createOrder error (${method}):`, err);
    res.status(502).json({ success: false, message: 'Error al crear la orden de pago.' });
  }
});

/**
 * POST /api/payments/capture-order
 * Captures a payment after user approval, then executes server commands.
 */
router.post('/capture-order', paymentLimiter, async (req: Request, res: Response) => {
  const { orderId, method } = req.body as { orderId?: string; method?: PaymentMethod };

  if (!orderId || typeof orderId !== 'string' || orderId.length > 100) {
    res.status(400).json({ success: false, message: 'orderId es requerido.' });
    return;
  }

  if (!method || !['paypal', 'stripe'].includes(method)) {
    res.status(400).json({ success: false, message: 'Método de pago inválido.' });
    return;
  }

  const gateway = getGateway(method);
  if (!gateway) {
    res.status(503).json({ success: false, message: `El método de pago ${method} no está disponible.` });
    return;
  }

  try {
    const capture = await gateway.captureOrder(orderId);

    // Update payment record
    await PaymentModel.updatePaymentStatus(
      orderId,
      capture.status,
      capture.payer?.email,
    );

    // If completed, resolve and execute server commands
    if (capture.status === 'completed') {
      const payment = await PaymentModel.getPaymentByProviderId(orderId);
      if (payment && isClientApiConfigured()) {
        try {
          const items = JSON.parse(payment.items) as PaymentItem[];

          // Resolve commands from server-side sources (DB for store items, RANKS for ranks)
          const commands = await resolveItemCommands(items);

          let commandsExecuted = 0;
          let commandsFailed = 0;

          for (const cmd of commands) {
            if (typeof cmd !== 'string' || cmd.length > 500) continue;
            const resolved = cmd.replace(/\{username\}/gi, payment.username);

            if (!isCommandAllowed(resolved)) {
              console.error(`[Payment ${orderId}] Blocked disallowed command: ${resolved}`);
              commandsFailed++;
              continue;
            }

            try {
              await sendCommand(resolved);
              commandsExecuted++;
              console.log(`[Payment ${orderId}] Command executed: ${resolved}`);
            } catch (cmdErr) {
              commandsFailed++;
              console.error(`[Payment ${orderId}] Command failed: ${resolved}`, cmdErr);
            }
          }

          console.log(`[Payment ${orderId}] Commands: ${commandsExecuted} ok, ${commandsFailed} failed, ${commands.length} total`);
        } catch (cmdErr) {
          console.error(`[Payment ${orderId}] Failed to execute post-payment commands:`, cmdErr);
        }
      }
    }

    res.json({
      success: true,
      data: {
        status: capture.status,
        orderId: capture.orderId,
        payer: capture.payer,
        amount: capture.amount,
        currency: capture.currency,
      },
    });
  } catch (err) {
    console.error(`Payment captureOrder error (${method}):`, err);
    res.status(502).json({ success: false, message: 'Error al capturar el pago.' });
  }
});

/**
 * GET /api/payments/status/:orderId
 */
router.get('/status/:orderId', async (req: Request<{ orderId: string }>, res: Response) => {
  try {
    const payment = await PaymentModel.getPaymentByProviderId(req.params.orderId);
    if (!payment) {
      res.status(404).json({ success: false, message: 'Orden no encontrada.' });
      return;
    }
    res.json({
      success: true,
      data: {
        status: payment.status,
        method: payment.method,
        username: payment.username,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.created_at,
      },
    });
  } catch (err) {
    console.error('Payment status check error:', err);
    res.status(500).json({ success: false, message: 'Error al consultar el estado del pago.' });
  }
});

export default router;
