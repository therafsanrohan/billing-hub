import { supabaseBrowserClient } from '@/lib/supabase/client';
import { Payment } from '@/lib/db';

export class PaymentService {
  /**
   * Record Payment and Allocate 20% Reserve atomically via PostgreSQL RPC
   */
  async recordPaymentAndAllocateReserve(params: {
    invoiceId: string;
    amount: number;
    paymentMethod: string;
    referenceNumber: string;
    bankAccountId?: string;
    notes?: string;
  }) {
    const supabase = supabaseBrowserClient;
    if (!supabase) throw new Error('Supabase client is not connected');

    const { data, error } = await supabase.rpc('record_payment_and_allocate_reserve', {
      p_invoice_id: params.invoiceId,
      p_amount: params.amount,
      p_payment_method: params.paymentMethod,
      p_reference_number: params.referenceNumber,
      p_bank_account_id: params.bankAccountId || null,
      p_notes: params.notes || null,
    });

    if (error) {
      throw new Error(`Atomic payment transaction failed: ${error.message}`);
    }

    return data;
  }

  async getPayments(): Promise<Payment[]> {
    const supabase = supabaseBrowserClient;
    if (!supabase) throw new Error('Supabase client is not connected');

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (error) throw new Error(`Cloud fetch payments failed: ${error.message}`);
    return data || [];
  }
}

export const paymentService = new PaymentService();
