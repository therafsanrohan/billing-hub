import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './supabase/config';

let isConfigured = false;
let client: ReturnType<typeof createBrowserClient> | null = null;

try {
  const { supabaseUrl, publishableKey } = getPublicSupabaseConfig();
  if (supabaseUrl && publishableKey) {
    client = createBrowserClient(supabaseUrl, publishableKey);
    isConfigured = true;
  }
} catch {
  isConfigured = false;
  client = null;
}

export const isSupabaseConfigured = isConfigured;
export const supabase = client;
