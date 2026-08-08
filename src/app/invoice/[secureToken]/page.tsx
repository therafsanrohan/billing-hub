import { redirect } from 'next/navigation';
import { getSanitizedPublicInvoice } from '@/lib/services/public-invoice-service';
import PublicInvoiceViewClient from './public-invoice-client';
import { ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PublicInvoicePage({
  params
}: {
  params: Promise<{ secureToken: string }>;
}) {
  const { secureToken } = await params;
  const result = await getSanitizedPublicInvoice(secureToken);

  if (!result.success && result.redirectTo) {
    redirect(`/invoice/${result.redirectTo}`);
  }

  if (!result.success || !result.invoice) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mb-4">
          <ShieldCheck className="h-8 w-8 text-[#100e09]" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">Invoice Link Unavailable</h1>
        <p className="text-sm text-gray-600 max-w-md mt-2 leading-relaxed">
          This invoice link is unavailable or has expired. Please reach out to your Account Manager to request a new secure link.
        </p>
      </div>
    );
  }

  return <PublicInvoiceViewClient invoice={result.invoice} />;
}
