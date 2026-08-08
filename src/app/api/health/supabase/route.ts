import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';

export async function GET() {
  let configured = false;
  let reachable = false;
  let authReachable = false;
  let databaseReachable = false;

  try {
    const config = getPublicSupabaseConfig();
    if (config.supabaseUrl && config.publishableKey) {
      configured = true;
    }

    const supabase = await createClient();

    // Test Auth Service Reachability (Safe ping)
    const { error: authError } = await supabase.auth.getSession();
    if (!authError || authError.status !== 0) {
      authReachable = true;
    }

    // Test Database Read Reachability (Safe 1-row read of public business_entities)
    const { data, error: dbError } = await supabase
      .from('business_entities')
      .select('id')
      .limit(1);

    if (!dbError) {
      databaseReachable = true;
      reachable = true;
    } else if (authReachable) {
      reachable = true;
    }
  } catch (err: any) {
    console.warn('[Health Endpoint Warning]', err.message || err);
  }

  return NextResponse.json(
    {
      configured,
      reachable,
      authReachable,
      databaseReachable,
      timestamp: new Date().toISOString(),
    },
    { status: configured && reachable ? 200 : 503 }
  );
}
