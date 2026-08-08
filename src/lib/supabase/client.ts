import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './config';

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseUrl, publishableKey } = getPublicSupabaseConfig();
  browserClient = createBrowserClient(supabaseUrl, publishableKey);
  return browserClient;
}

export const supabaseBrowserClient = createClient();
