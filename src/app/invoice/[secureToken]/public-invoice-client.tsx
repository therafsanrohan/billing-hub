'use client';

import { PublicInvoiceViewModel } from '@/lib/services/public-invoice-service';
import { getCanonicalPublicInvoiceUrl } from '@/lib/security/public-invoice-token';
import InvoiceDocument from '@/components/invoice/invoice-document';
import { InvoiceDocumentViewModel } from '@/components/invoice/invoice-document.types';
import { Printer, Download, ShieldCheck } from 'lucide-react';

interface Props {
  invoice: PublicInvoiceViewModel;
}

export default function PublicInvoiceViewClient({ invoice }: Props) {
  const canonicalUrl = getCanonicalPublicInvoiceUrl(invoice.canonicalToken);

  const doc: InvoiceDocumentViewModel = {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    isDraft: false,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    projectName: invoice.projectName,
    servicePeriod: invoice.servicePeriod,
    poNumber: invoice.poNumber,
    referenceNumber: invoice.referenceNumber,
    items: invoice.items,
    totals: {
      subtotal: invoice.totals.subtotal,
      discountAmount: invoice.totals.discountAmount,
      vatAmount: invoice.totals.vatAmount,
      totalPayable: invoice.totals.totalPayable,
      amountPaid: invoice.totals.amountPaid,
      amountDue: invoice.totals.amountDue
    },
    client: invoice.client,
    entity: invoice.entity,
    bankAccount: invoice.bankAccount,
    paymentInstructions: invoice.paymentInstructions,
    termsConditions: invoice.termsConditions,
    verificationUrl: canonicalUrl,
    canonicalToken: invoice.canonicalToken
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.open(`/api/public/invoices/${invoice.canonicalToken}/pdf`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Action Header Bar (No Print) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 no-print bg-[#f5f4eb] p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#100e09]/10 text-[#100e09]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-gray-900">Official Client Document</h2>
            <p className="text-[11px] text-gray-500">Verified Secure Capability Link</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 rounded-xl border border-gray-300 bg-[#f5f4eb] px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition cursor-pointer"
          >
            <Printer className="h-4 w-4 text-gray-500" />
            <span>Print Invoice</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 rounded-xl bg-[#100e09] px-4 py-2.5 text-xs font-semibold text-[#f5f4eb] hover:bg-[#80171C] shadow-md transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Canonical Printable Document */}
      <InvoiceDocument document={doc} />
    </div>
  );
}

