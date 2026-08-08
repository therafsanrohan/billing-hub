import { supabase, isSupabaseConfigured } from '../supabase';
import { Payment, localStore, db } from '../db';

export const paymentService = {
  getPayments: async (): Promise<Payment[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('invoice_payments').select('*').order('payment_date', { ascending: false });
      if (data && data.length > 0) {
        localStore.payments = data;
        return data;
      }
    }
    return localStore.payments;
  },

  recordPayment: async (payment: Omit<Payment, 'id' | 'receipt_number' | 'created_at'>): Promise<Payment> => {
    const user = await db.getCurrentUser();

    // Direct atomic database RPC call if Supabase is configured
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('record_payment_and_allocate_reserve', {
        p_invoice_id: payment.invoice_id,
        p_payment_date: payment.payment_date,
        p_amount: payment.amount,
        p_currency: payment.currency,
        p_payment_method: payment.payment_method,
        p_transaction_reference: payment.transaction_reference || null,
        p_bank_gateway: payment.bank_gateway || null,
        p_recorded_by: user.id,
        p_internal_note: payment.internal_note || null
      });

      if (!error && data) {
        // Re-sync payments list from cloud
        await paymentService.getPayments();
      }
    }

    // Always invoke db.recordPayment for LocalStore & System Notification sync
    return await db.recordPayment(payment);
  },

  reversePayment: async (paymentId: string, reason: string): Promise<boolean> => {
    const user = await db.getCurrentUser();
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('reverse_payment_and_adjust_reserve', {
        p_payment_id: paymentId,
        p_reason: reason,
        p_reversed_by: user.id
      });
      if (error) throw new Error(error.message);
    }

    // LocalStore fallback reversal
    const payments = localStore.payments.filter(p => p.id !== paymentId);
    localStore.payments = payments;
    return true;
  }
};
