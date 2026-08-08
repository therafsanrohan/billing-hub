import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  // Validate public invoice token routes to prevent path traversal / injection
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/invoice/')) {
    const rawSegment = pathname.replace('/invoice/', '');
    const token = decodeURIComponent(rawSegment.split('?')[0].split('/')[0]);
    if (!token || !/^[a-zA-Z0-9_.-]+$/.test(token)) {
      return new NextResponse('Invalid or Malformed Secure Token', { status: 400 });
    }
  }

  // Session update and route protection
  const sessionResponse = await updateSession(request);

  // Add Security Headers
  sessionResponse.headers.set('X-Content-Type-Options', 'nosniff');
  sessionResponse.headers.set('X-Frame-Options', 'DENY');
  sessionResponse.headers.set('X-XSS-Protection', '1; mode=block');
  sessionResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return sessionResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
