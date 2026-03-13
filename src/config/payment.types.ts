// ==========================================
// Payment Gateway Abstraction
// ==========================================
// Unified interface for PayPal and Stripe payment methods.
// Each gateway implements this interface to keep checkout logic provider-agnostic.

export type PaymentMethod = 'paypal' | 'stripe';

export interface PaymentItem {
  name: string;
  description?: string;
  price: number;
  quantity: number;
  /** Server commands to execute when this item is purchased. Use {username} placeholder. */
  commands?: string[];
  /** Store item ID for server-side price verification */
  storeItemId?: string;
}

export interface CreateOrderRequest {
  username: string;
  items: PaymentItem[];
  method: PaymentMethod;
  /** Return URL after successful payment */
  returnUrl: string;
  /** URL if user cancels payment */
  cancelUrl: string;
  /** If true, create order for JS SDK popup (no redirect URLs in payment_source) */
  inline?: boolean;
}

export interface CreateOrderResult {
  /** Internal order/payment ID */
  orderId: string;
  /** URL to redirect user for payment approval */
  approvalUrl: string;
  /** Payment provider (paypal, stripe) */
  method: PaymentMethod;
  /** Provider-specific order/session ID */
  providerOrderId: string;
}

export interface CaptureOrderResult {
  orderId: string;
  providerOrderId: string;
  status: 'completed' | 'pending' | 'failed';
  method: PaymentMethod;
  payer?: {
    email?: string;
    name?: string;
  };
  amount: number;
  currency: string;
}

export interface PaymentGateway {
  /** Unique payment method identifier */
  method: PaymentMethod;
  /** Whether this gateway is configured and ready */
  isConfigured(): boolean;
  /** Create a new payment order and return an approval URL */
  createOrder(request: CreateOrderRequest): Promise<CreateOrderResult>;
  /** Capture/confirm a payment after user approval (PayPal/Stripe) */
  captureOrder(providerOrderId: string): Promise<CaptureOrderResult>;
}
