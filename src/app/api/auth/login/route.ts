import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password } = body || {};

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: 'The username/email or password is incorrect.' },
        { status: 400 }
      );
    }

    let resolvedEmail = String(identifier).trim();

    // If identifier is a username (does not contain '@')
    if (!resolvedEmail.includes('@')) {
      const normalizedUsername = resolvedEmail.toLowerCase();
      try {
        const adminSupabase = createAdminClient();
        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('email')
          .eq('username', normalizedUsername)
          .maybeSingle();

        if (profile?.email) {
          resolvedEmail = profile.email;
        } else {
          // Return generic error message to prevent username enumeration
          return NextResponse.json(
            { success: false, message: 'The username/email or password is incorrect.' },
            { status: 401 }
          );
        }
      } catch (err: any) {
        console.warn('[Login Username Resolution Warning]', err.message || err);
        return NextResponse.json(
          { success: false, message: 'The username/email or password is incorrect.' },
          { status: 401 }
        );
      }
    }

    const { supabaseUrl, publishableKey } = getPublicSupabaseConfig();
    let response = NextResponse.json({ success: true, redirectTo: '/billing' });

    const supabase = createServerClient(supabaseUrl, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    if (error || !data?.user) {
      return NextResponse.json(
        { success: false, message: 'The username/email or password is incorrect.' },
        { status: 401 }
      );
    }

    return response;
  } catch (err: any) {
    console.error('[Login API Error]', err.message || err);
    return NextResponse.json(
      { success: false, message: 'An unexpected authentication error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
