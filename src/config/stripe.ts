// ==========================================
// Stripe Payment Gateway (Placeholder)
// ==========================================
// Ready for future implementation. Install `stripe` package when needed:
//   npm install stripe
//
// Implements the PaymentGateway interface.
// When you're ready to activate Stripe:
// 1. npm install stripe
// 2. Fill in STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY in .env
// 3. Uncomment the implementation below and replace the placeholder methods.

import env from './env.js';
import type {
  PaymentGateway,
  CreateOrderRequest,
  CreateOrderResult,
  CaptureOrderResult,
} from './payment.types.js';

export const stripeGateway: PaymentGateway = {
  method: 'stripe',

  isConfigured(): boolean {
    return !!(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY);
  },

  async createOrder(_request: CreateOrderRequest): Promise<CreateOrderResult> {
    // ================================================================
    // STRIPE IMPLEMENTATION (uncomment when stripe package is installed)
    // ================================================================
    //
    // import Stripe from 'stripe';
    // const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    //
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   mode: 'payment',
    //   locale: 'es',
    //   customer_email: undefined,
    //   metadata: {
    //     username: request.username,
    //   },
    //   line_items: request.items.map((item) => ({
    //     price_data: {
    //       currency: 'usd',
    //       product_data: {
    //         name: item.name,
    //         description: item.description,
    //       },
    //       unit_amount: Math.round(item.price * 100), // Stripe uses cents
    //     },
    //     quantity: item.quantity,
    //   })),
    //   success_url: request.returnUrl,
    //   cancel_url: request.cancelUrl,
    // });
    //
    // return {
    //   orderId: session.id,
    //   approvalUrl: session.url!,
    //   method: 'stripe',
    //   providerOrderId: session.id,
    // };

    throw new Error('Stripe no está configurado todavía. Contacta al administrador.');
  },

  async captureOrder(_providerOrderId: string): Promise<CaptureOrderResult> {
    // ================================================================
    // STRIPE CAPTURE (Stripe auto-captures on checkout.session.completed webhook)
    // ================================================================
    //
    // import Stripe from 'stripe';
    // const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    //
    // const session = await stripe.checkout.sessions.retrieve(providerOrderId);
    //
    // return {
    //   orderId: session.id,
    //   providerOrderId: session.payment_intent as string,
    //   status: session.payment_status === 'paid' ? 'completed' : 'pending',
    //   method: 'stripe',
    //   payer: {
    //     email: session.customer_email ?? undefined,
    //     name: session.customer_details?.name ?? undefined,
    //   },
    //   amount: (session.amount_total ?? 0) / 100,
    //   currency: session.currency ?? 'usd',
    // };

    throw new Error('Stripe no está configurado todavía. Contacta al administrador.');
  },
};

// ---- Stripe Webhook Handler (placeholder) ----
// When implementing, add this route to handle Stripe webhooks:
//
// router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
//   const sig = req.headers['stripe-signature'] as string;
//   const stripe = new Stripe(env.STRIPE_SECRET_KEY);
//
//   let event: Stripe.Event;
//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
//   } catch (err) {
//     res.status(400).send(`Webhook Error: ${err}`);
//     return;
//   }
//
//   switch (event.type) {
//     case 'checkout.session.completed': {
//       const session = event.data.object as Stripe.Checkout.Session;
//       const username = session.metadata?.username;
//       // Process completed payment: assign rank, deliver items, etc.
//       // await processPaymentCompletion(username, session.id);
//       break;
//     }
//   }
//
//   res.json({ received: true });
// });
