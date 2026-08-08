'use client';

import { useState } from 'react';
import { Printer, Download, Share2, Copy, Check, ShieldCheck } from 'lucide-react';

interface Props {
  canonicalToken?: string;
  pdfUrl?: string;
  publicUrl?: string;
  invoiceNumber: string;
  clientCompanyName: string;
  isDraft?: boolean;
}

export default function InvoiceActions({
  canonicalToken,
  pdfUrl,
  publicUrl,
  invoiceNumber,
  clientCompanyName,
  isDraft
}: Props) {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else if (canonicalToken) {
      window.open(`/api/public/invoices/${canonicalToken}/pdf`, '_blank');
    } else {
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (!publicUrl && !canonicalToken) return;
    const linkToCopy = publicUrl || `${window.location.origin}/invoice/${canonicalToken}`;
    navigator.clipboard.writeText(linkToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const linkToShare = publicUrl || `${window.location.origin}/invoice/${canonicalToken}`;
    const text = `Hi ${clientCompanyName},\n\nPlease review your official invoice ${invoiceNumber} from app:\n${linkToShare}\n\nThank you!`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="no-print bg-[#f5f4eb] p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-[210mm] mx-auto mb-6">
      <div className="flex items-center space-x-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#100e09]/10 text-[#100e09]">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">
            {isDraft ? 'Internal Invoice Draft' : `Official Document (${invoiceNumber})`}
          </h2>
          <p className="text-xs text-gray-500">
            {isDraft ? 'Draft state - not yet finalized' : 'Verified Secure Digital Invoice'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5 w-full sm:w-auto">
        <button
          type="button"
          onClick={handlePrint}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 rounded-lg border border-gray-300 bg-[#f5f4eb] px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-xs transition cursor-pointer"
        >
          <Printer className="h-4 w-4 text-gray-500" />
          <span>Print</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 rounded-lg bg-[#100e09] px-3.5 py-2 text-xs font-bold text-[#f5f4eb] hover:bg-[#80171C] shadow-xs transition cursor-pointer"
        >
          <Download className="h-4 w-4" />
          <span>Download PDF</span>
        </button>

        {!isDraft && (canonicalToken || publicUrl) && (
          <>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center space-x-1.5 rounded-lg border border-gray-300 bg-[#f5f4eb] px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-xs transition cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
              <span>{copied ? 'Copied' : 'Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-[#f5f4eb] hover:bg-[#128C7E] shadow-xs transition cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
              <span>WhatsApp</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
