import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicSupabaseConfig } from './config';

export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, anonKey } = getPublicSupabaseConfig();

  return createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
