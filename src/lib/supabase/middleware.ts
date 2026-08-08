import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicSupabaseConfig } from './config';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const { supabaseUrl, publishableKey } = getPublicSupabaseConfig();

    const supabase = createServerClient(supabaseUrl, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Refresh user auth session safely
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // If a network exception or timeout occurs, do NOT crash middleware or start a redirect loop
    if (error && (error.message?.includes('fetch') || error.status === 0)) {
      console.warn('[Middleware Network Warning] Supabase auth API unreachable:', error.message);
      return supabaseResponse;
    }

    // Protect all /billing routes except login
    const isBillingRoute = request.nextUrl.pathname.startsWith('/billing');
    const isLoginPage = request.nextUrl.pathname === '/login';

    if (isBillingRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (isLoginPage && user) {
      const url = request.nextUrl.clone();
      url.pathname = '/billing';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (err: any) {
    console.error('[Middleware Error]', err.message || err);
    return supabaseResponse;
  }
}
