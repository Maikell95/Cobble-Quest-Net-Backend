import { supabase } from '../config/supabase.js';
import type { PaymentMethod } from '../config/payment.types.js';

const TABLE = 'payments';

export interface PaymentRow {
  id: string;
  provider_order_id: string;
  method: PaymentMethod;
  username: string;
  items: string; // JSON string
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payer_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentDTO {
  providerOrderId: string;
  method: PaymentMethod;
  username: string;
  items: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createPayment(dto: CreatePaymentDTO): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      provider_order_id: dto.providerOrderId,
      method: dto.method,
      username: dto.username,
      items: dto.items,
      amount: dto.amount,
      currency: dto.currency,
      status: dto.status,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PaymentRow;
}

export async function updatePaymentStatus(
  providerOrderId: string,
  status: string,
  payerEmail?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (payerEmail) update.payer_email = payerEmail;

  const { error } = await supabase
    .from(TABLE)
    .update(update)
    .eq('provider_order_id', providerOrderId);
  if (error) throw error;
}

export async function getPaymentByProviderId(providerOrderId: string): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('provider_order_id', providerOrderId)
    .single();
  if (error) return null;
  return data as PaymentRow;
}

export async function getPaymentsByUsername(username: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('username', username)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PaymentRow[];
}
