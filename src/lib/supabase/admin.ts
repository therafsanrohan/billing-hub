if (typeof window !== 'undefined') {
  throw new Error('createAdminClient is server-only and cannot be executed in a browser Client Component.');
}

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from './config';

export function createAdminClient() {
  const { supabaseUrl, secretKey } = getServerSupabaseConfig();

  return createSupabaseClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
