import { NextRequest, NextResponse } from 'next/server';
import {
  getOrGeneratePublicInvoiceToken,
  rotatePublicInvoiceLink,
  revokePublicInvoiceLink
} from '@/lib/services/public-invoice-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const linkData = await getOrGeneratePublicInvoiceToken(id);
    return NextResponse.json({ success: true, ...linkData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch public link' }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (action === 'rotate') {
      const linkData = await rotatePublicInvoiceLink(id, reason);
      return NextResponse.json({ success: true, ...linkData });
    } else if (action === 'revoke') {
      await revokePublicInvoiceLink(id);
      return NextResponse.json({ success: true, message: 'Public link revoked successfully' });
    }

    const linkData = await getOrGeneratePublicInvoiceToken(id);
    return NextResponse.json({ success: true, ...linkData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Action failed' }, { status: 400 });
  }
}
