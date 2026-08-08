import { supabaseBrowserClient } from '@/lib/supabase/client';
import { FdrAccount, DpsAccount, DpsInstallment } from '@/lib/db';

export class InvestmentService {
  async getFdrs(): Promise<FdrAccount[]> {
    const supabase = supabaseBrowserClient;
    if (!supabase) throw new Error('Supabase client is not connected');

    const { data, error } = await supabase
      .from('fdr_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Cloud fetch FDRs failed: ${error.message}`);
    return data || [];
  }

  async createFdr(fdr: Omit<FdrAccount, 'id' | 'created_at' | 'updated_at'>): Promise<FdrAccount> {
    const supabase = supabaseBrowserClient;
    if (!supabase) throw new Error('Supabase client is not connected');

    const { data, error } = await supabase
      .from('fdr_records')
      .insert([fdr])
      .select()
      .single();

    if (error) throw new Error(`Cloud create FDR failed: ${error.message}`);
    return data;
  }

  async getDpsList(): Promise<DpsAccount[]> {
    const supabase = supabaseBrowserClient;
    if (!supabase) throw new Error('Supabase client is not connected');

    const { data, error } = await supabase
      .from('dps_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Cloud fetch DPS failed: ${error.message}`);
    return data || [];
  }

  async createDps(dps: Omit<DpsAccount, 'id' | 'created_at' | 'updated_at'>): Promise<DpsAccount> {
    const supabase = supabaseBrowserClient;
    if (!supabase) throw new Error('Supabase client is not connected');

    const { data, error } = await supabase
      .from('dps_records')
      .insert([dps])
      .select()
      .single();

    if (error) throw new Error(`Cloud create DPS failed: ${error.message}`);
    return data;
  }

  async getDpsInstallments(dpsId: string): Promise<DpsInstallment[]> {
    const supabase = supabaseBrowserClient;
    if (!supabase) throw new Error('Supabase client is not connected');

    const { data, error } = await supabase
      .from('dps_installments')
      .select('*')
      .eq('dps_id', dpsId)
      .order('due_date', { ascending: true });

    if (error) throw new Error(`Cloud fetch DPS installments failed: ${error.message}`);
    return data || [];
  }
}

export const investmentService = new InvestmentService();
