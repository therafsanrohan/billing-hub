import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './config';

export function createClient() {
  const { supabaseUrl, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient(supabaseUrl, anonKey);
}
