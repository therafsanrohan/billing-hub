import { supabase, isSupabaseConfigured } from '../supabase';
import { BillingClient, localStore } from '../db';

export const clientService = {
  getClients: async (): Promise<BillingClient[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('billing_clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        localStore.clients = data;
        return data;
      }
    }
    return localStore.clients;
  },

  getClientById: async (id: string): Promise<BillingClient | null> => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('billing_clients').select('*').eq('id', id).single();
      if (data) return data;
    }
    const list = localStore.clients;
    return list.find(c => c.id === id) || null;
  },

  createClient: async (client: Omit<BillingClient, 'id' | 'created_at' | 'updated_at'>): Promise<BillingClient> => {
    const newClient: BillingClient = {
      ...client,
      id: `cli-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const list = localStore.clients;
    list.unshift(newClient);
    localStore.clients = list;

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('billing_clients').insert([newClient]).select().single();
      if (data) return data;
    }

    return newClient;
  },

  updateClient: async (id: string, updates: Partial<BillingClient>): Promise<BillingClient> => {
    const list = localStore.clients;
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Client not found');

    const updated = {
      ...list[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    list[idx] = updated;
    localStore.clients = list;

    if (isSupabaseConfigured && supabase) {
      await supabase.from('billing_clients').update(updates).eq('id', id);
    }

    return updated;
  }
};
