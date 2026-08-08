import { supabaseBrowserClient } from '@/lib/supabase/client';

export interface AuditLogEntry {
  id?: string;
  organization_id?: string;
  actor_id?: string;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  previous_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

export class AuditService {
  async logAction(entry: AuditLogEntry): Promise<void> {
    const supabase = supabaseBrowserClient;
    if (!supabase) return;

    try {
      await supabase.from('audit_logs').insert([entry]);
    } catch (e) {
      console.error('Audit logging failed:', e);
    }
  }

  async getAuditLogs(entityType?: string, entityId?: string): Promise<AuditLogEntry[]> {
    const supabase = supabaseBrowserClient;
    if (!supabase) throw new Error('Supabase client is not connected');

    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });

    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);

    const { data, error } = await query;
    if (error) throw new Error(`Cloud fetch audit logs failed: ${error.message}`);
    return data || [];
  }
}

export const auditService = new AuditService();
