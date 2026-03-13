// ==========================================
// PayPal REST API Client
// ==========================================
// Docs: https://developer.paypal.com/docs/api/orders/v2/
// Implements the PaymentGateway interface for PayPal Checkout.

import env from './env.js';
import type {
  PaymentGateway,
  CreateOrderRequest,
  CreateOrderResult,
  CaptureOrderResult,
  PaymentItem,
} from './payment.types.js';

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const LIVE_BASE = 'https://api-m.paypal.com';

function getBaseUrl(): string {
  return env.PAYPAL_MODE === 'live' ? LIVE_BASE : SANDBOX_BASE;
}

/**
 * Get an OAuth2 access token from PayPal.
 */
async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`,
  ).toString('base64');

  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function buildPurchaseItems(items: PaymentItem[]) {
  return items.map((item) => ({
    name: item.name.slice(0, 127),
    description: item.description?.slice(0, 127) || undefined,
    quantity: String(item.quantity),
    unit_amount: {
      currency_code: 'USD',
      value: item.price.toFixed(2),
    },
  }));
}

function calculateTotal(items: PaymentItem[]): string {
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return total.toFixed(2);
}

export const paypalGateway: PaymentGateway = {
  method: 'paypal',

  isConfigured(): boolean {
    return !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
  },

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    const token = await getAccessToken();
    const total = calculateTotal(request.items);

    const orderPayload: Record<string, unknown> = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: request.username,
          description: `Cobble Quest - Compra de ${request.username}`,
          amount: {
            currency_code: 'USD',
            value: total,
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: total,
              },
            },
          },
          items: buildPurchaseItems(request.items),
        },
      ],
    };

    // When inline=true (JS SDK popup), omit payment_source so the SDK handles the flow.
    // When inline=false (redirect), include payment_source with return/cancel URLs.
    if (!request.inline) {
      orderPayload.payment_source = {
        paypal: {
          experience_context: {
            brand_name: 'Cobble Quest',
            locale: 'es-ES',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: request.returnUrl,
            cancel_url: request.cancelUrl,
          },
        },
      };
    }

    const res = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal createOrder failed (${res.status}): ${text}`);
    }

    const order = await res.json() as PayPalOrder;

    // Inline (JS SDK) returns "approve", redirect mode returns "payer-action"
    const approvalLink = order.links.find(
      (l) => l.rel === 'approve' || l.rel === 'payer-action',
    );
    if (!approvalLink) {
      throw new Error('PayPal order created but no approval URL found');
    }

    return {
      orderId: order.id,
      approvalUrl: approvalLink.href,
      method: 'paypal',
      providerOrderId: order.id,
    };
  },

  async captureOrder(providerOrderId: string): Promise<CaptureOrderResult> {
    const token = await getAccessToken();

    const res = await fetch(
      `${getBaseUrl()}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal captureOrder failed (${res.status}): ${text}`);
    }

    const capture = await res.json() as PayPalCaptureResponse;

    const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const amount = captureUnit ? parseFloat(captureUnit.amount.value) : 0;
    const currency = captureUnit?.amount.currency_code || 'USD';

    return {
      orderId: capture.id,
      providerOrderId: capture.id,
      status: capture.status === 'COMPLETED' ? 'completed' : 'pending',
      method: 'paypal',
      payer: {
        email: capture.payer?.email_address,
        name: capture.payer?.name
          ? `${capture.payer.name.given_name} ${capture.payer.name.surname}`
          : undefined,
      },
      amount,
      currency,
    };
  },
};

// ---- PayPal API Types ----

interface PayPalLink {
  href: string;
  rel: string;
  method: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  links: PayPalLink[];
}

interface PayPalCaptureResponse {
  id: string;
  status: 'COMPLETED' | 'PENDING' | 'DECLINED' | 'VOIDED';
  purchase_units: Array<{
    reference_id: string;
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }>;
    };
  }>;
  payer: {
    email_address?: string;
    name?: { given_name: string; surname: string };
    payer_id: string;
  };
}
