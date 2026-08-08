'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, Invoice, BillingClient, InvoiceItem, Payment, BankAccount, BusinessEntity } from '@/lib/db';
import { calculateTotals, formatCurrency } from '@/lib/calculations';
import Link from 'next/link';
import { ArrowLeft, Printer, Send, Loader2, Building2, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import NotificationModal from '@/components/NotificationModal';

export default function InvoicePreviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<BillingClient | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [entity, setEntity] = useState<BusinessEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyUrl, setVerifyUrl] = useState('');
  const [sharingWa, setSharingWa] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  const showNotif = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModalState({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    async function loadData() {
      try {
        const inv = await db.getInvoiceById(id);
        if (!inv) {
          router.push('/billing/invoices');
          return;
        }
        setInvoice(inv);

        // Build verification URL from signed public link
        if (typeof window !== 'undefined') {
          try {
            const res = await fetch(`/api/invoices/${id}/public-link`);
            const data = await res.json();
            if (data.success && data.url) {
              setVerifyUrl(data.url);
            } else if (inv.secure_token) {
              setVerifyUrl(`${window.location.origin}/invoice/${inv.secure_token}`);
            }
          } catch {
            if (inv.secure_token) {
              setVerifyUrl(`${window.location.origin}/invoice/${inv.secure_token}`);
            }
          }
        }
        
        // Set document title for PDF print filename
        if (typeof document !== 'undefined') {
          document.title = `Invoice_${inv.invoice_number || 'Draft'}`;
        }

        const cl = await db.getClientById(inv.client_id);
        if (cl) setClient(cl);

        const ents = await db.getEntities();
        const activeEnt = ents.find(e => e.id === inv.entity_id) || ents.find(e => e.entity_code === (inv.currency === 'BDT' ? 'CLTD' : 'CLLC'));
        if (activeEnt) setEntity(activeEnt);

        const invItems = await db.getInvoiceItems(id);
        setItems(invItems);

        const pays = await db.getPaymentsForInvoice(id);
        setPayments(pays);

        const banks = await db.getBankAccounts();
        const activeBank = banks.find(b => b.entity_id === inv.entity_id && b.is_active);
        if (activeBank) setBankAccount(activeBank);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, router]);

  useEffect(() => {
    if (!loading && invoice && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('whatsapp') === 'true') {
        window.history.replaceState({}, document.title, window.location.pathname);
        handleWhatsAppShare();
      }
    }
  }, [loading, invoice]);

  if (loading || !invoice) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  const totals = calculateTotals({
    items: items.map(i => ({ quantity: i.quantity, rate: i.rate })),
    discountType: invoice.discount_type,
    discountValue: invoice.discount_value,
    vatRate: invoice.vat_rate,
    vatInclusive: invoice.vat_inclusive,
    payments
  });

  const isBdt = invoice.currency === 'BDT';

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!invoice) return;
    const docLink = verifyUrl || (typeof window !== 'undefined' ? window.location.href : '');
    const message = `Hello ${client?.contact_person || client?.company_name || 'Valued Client'},\n\nPlease find the official invoice ${invoice.invoice_number || 'Draft'} for ${invoice.project_name}.\n\nView & Download Digital Invoice:\n${docLink}\n\nThank you,\n${entity ? entity.legal_name : (isBdt ? 'Corevow Limited' : 'Corevow LLC')}`;
    const cleanPhone = client?.phone ? client.phone.replace(/[^0-9]/g, '') : '';
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    // Open WhatsApp immediately and synchronously to bypass browser popup restrictions on mobile & desktop
    if (typeof window !== 'undefined') {
      const win = window.open(waUrl, '_blank');
      if (!win) {
        window.location.href = waUrl;
      }
    }

    // Trigger PDF download asynchronously in background
    (async () => {
      try {
        setSharingWa(true);
        const element = document.getElementById('print-area') as HTMLElement;
        // @ts-ignore
        const html2pdf = (await import('html2pdf.js')).default;
        const opt: any = {
          margin:       [6, 6, 8, 6],
          filename:     `Invoice_${invoice.invoice_number || 'Draft'}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            windowWidth: 1024,
            width: 794
          },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };
        await html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error('PDF export background error:', err);
      } finally {
        setSharingWa(false);
      }
    })();
  };

  const statusColor: Record<string, string> = {
    paid: 'bg-green-100 text-green-700 border-green-200',
    partially_paid: 'bg-amber-100 text-amber-700 border-amber-200',
    overdue: 'bg-red-100 text-red-700 border-red-200',
    sent: 'bg-blue-100 text-blue-700 border-blue-200',
    draft: 'bg-gray-100 text-gray-500 border-gray-200',
    void: 'bg-gray-100 text-gray-400 border-gray-200',
    approved: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] py-4 sm:py-8 px-2 sm:px-4">
      
      {/* Action Controls Header - hidden during print */}
      <div className="max-w-[210mm] mx-auto mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 bg-[#f5f4eb] border border-gray-100 p-3 sm:p-4 rounded-2xl shadow-sm no-print">
        <Link href={`/billing/invoices/${id}`} className="inline-flex items-center space-x-2 text-xs font-semibold text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Invoice Ledger Details</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleWhatsAppShare}
            disabled={sharingWa}
            className="flex items-center space-x-1.5 rounded-lg bg-[#25D366] py-2 px-4 text-xs font-bold text-[#f5f4eb] hover:bg-[#128C7E] shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {sharingWa ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>Send via WhatsApp</span>
          </button>
          <button
            id="btn-print-invoice-preview"
            onClick={handlePrint}
            className="flex items-center space-x-1.5 rounded-lg bg-[#100e09] py-2 px-4 text-xs font-bold text-[#f5f4eb] hover:bg-[#7d1219] shadow-sm transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* A4 Canvas Container */}
      <div className="w-full flex justify-center pb-6">
      <div
        id="print-area"
        className="w-full max-w-[210mm] bg-[#f5f4eb] shadow-lg border border-gray-100 p-6 sm:p-10 text-[#1E1E1E] flex flex-col justify-between font-sans relative select-none box-border"
        style={{ minHeight: '297mm' }}
      >
        {/* Document Top */}
        <div>
          {/* Header block */}
          <div className="flex justify-between items-start pb-4 border-b border-gray-100">
            <div>
              {/* Corevow logo */}
              <div className="flex items-center space-x-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logos/app%20logo.svg"
                  alt="app"
                  className="h-7 sm:h-8 md:h-9 w-auto max-w-[200px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/logos/SVG/corevow-logo.svg'; }}
                />
              </div>

              {/* Entity address particulars */}
              <div className="mt-3 text-[10px] text-gray-500 space-y-0.5 leading-normal">
                <span className="font-bold text-gray-800 block">
                  {entity ? entity.legal_name : (isBdt ? 'Corevow Limited' : 'Corevow LLC')}
                </span>
                <span>
                  {entity ? entity.registered_address : (isBdt
                    ? 'House 12, Road 4, Banani, Dhaka 1213, Bangladesh'
                    : '1619 Broadway, Suite 500, New York, NY 10019, USA')}
                </span>
                <span className="block">
                  Registration: {entity ? entity.registration_number : (isBdt ? 'C-CLTD-DHAKA-2026' : 'NY-CLLC-2026-98765')}
                </span>
                <span className="block">
                  {isBdt ? 'TIN / BIN: ' : 'EIN: '}{entity ? entity.tax_id : (isBdt ? 'TIN-BIN-CLTD-123456' : 'EIN-12-3456789')}
                </span>
                <span className="block">Email: {entity ? entity.email : 'app@gmail.com'}</span>
                <span className="block">Phone: {entity ? entity.phone : '+880 1325 078 941'}</span>
              </div>
            </div>

            {/* Invoice meta + status */}
            <div className="text-right flex flex-col items-end space-y-3">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-300 tracking-widest uppercase">INVOICE</h2>
                {invoice.status && (
                  <span className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusColor[invoice.status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {invoice.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              
              <div className="space-y-1 text-xs text-gray-500">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-semibold block">Invoice Number</span>
                  <span className="font-bold text-gray-800">{invoice.invoice_number || 'DRAFT-PENDING'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-semibold block">Issue Date</span>
                  <span className="font-bold text-gray-800">{invoice.issue_date}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 uppercase font-semibold block">Due Date</span>
                  <span className="font-bold text-[#100e09]">{invoice.due_date}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billing particulars split */}
          <div className="grid grid-cols-2 gap-6 py-4 border-b border-gray-100 text-xs">
            <div>
              <span className="font-bold text-gray-400 uppercase tracking-wider block text-[9px] mb-1">BILL TO:</span>
              {client ? (
                <div className="space-y-0.5 text-gray-600 leading-normal">
                  <p className="font-bold text-gray-800 text-xs">{client.company_name || client.contact_person}</p>
                  {client.company_name && <p className="font-semibold text-[11px]">{client.contact_person}</p>}
                  <p className="text-[11px]">{client.billing_address}</p>
                  <p className="text-[11px]">{client.city}, {client.country}</p>
                  <p className="text-[11px]">Email: {client.billing_email}</p>
                  {client.tax_number && <p className="font-semibold text-[11px]">Tax/VAT ID: {client.tax_number}</p>}
                </div>
              ) : (
                <span className="text-gray-400 italic">No client profile mapped</span>
              )}
            </div>

            <div>
              <span className="font-bold text-gray-400 uppercase tracking-wider block text-[9px] mb-1">PROJECT INFORMATION:</span>
              <div className="space-y-0.5 text-gray-600">
                <p className="font-bold text-gray-800 text-xs">{invoice.project_name}</p>
                {invoice.service_period && (
                  <p className="text-[11px]">
                    <span className="font-semibold text-gray-400 block text-[9px] uppercase">Service Period</span>
                    <span className="font-semibold">{invoice.service_period}</span>
                  </p>
                )}
                {invoice.po_number && <p className="text-[11px]">PO Number: <span className="font-semibold">{invoice.po_number}</span></p>}
                {invoice.reference_number && <p className="text-[11px]">Reference: <span className="font-semibold">{invoice.reference_number}</span></p>}
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="py-4">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-2 w-[48%] pr-2">Service Lines Description</th>
                  <th className="py-2 text-right w-[14%] px-1">Quantity</th>
                  <th className="py-2 text-right w-[19%] px-1">Rate</th>
                  <th className="py-2 text-right w-[19%] pl-1">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {items.map((itm) => (
                  <tr key={itm.id} className="align-top avoid-break">
                    <td className="py-2.5 pr-2 break-words">
                      <span className="font-bold text-gray-800 block text-xs">{itm.service_name}</span>
                      {itm.description && <span className="text-[10px] text-gray-400 leading-tight block mt-0.5 whitespace-pre-line">{itm.description}</span>}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap px-1 font-medium">{itm.quantity} {itm.unit}</td>
                    <td className="py-2.5 text-right whitespace-nowrap px-1 font-medium">{formatCurrency(itm.rate, invoice.currency)}</td>
                    <td className="py-2.5 text-right font-bold text-gray-800 whitespace-nowrap pl-1">{formatCurrency(itm.quantity * itm.rate, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Document Bottom */}
        <div className="space-y-4 pt-3 border-t border-gray-150 avoid-break">
          {/* Totals Section (Right Aligned) */}
          <div className="flex justify-end avoid-break">
            <div className="w-full sm:w-72 space-y-1.5 text-xs text-gray-700 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Subtotal:</span>
                <span className="font-bold">{formatCurrency(totals.subtotal, invoice.currency)}</span>
              </div>
              
              {invoice.discount_type !== 'none' && (
                <div className="flex justify-between text-[#100e09]">
                  <span className="font-semibold">Discount Adjustment:</span>
                  <span className="font-bold">-{formatCurrency(totals.discountAmount, invoice.currency)}</span>
                </div>
              )}

              {isBdt && invoice.vat_rate > 0 ? (
                <div className="flex justify-between text-gray-500">
                  <span className="font-semibold">
                    VAT ({invoice.vat_rate}% {invoice.vat_inclusive ? 'Included' : 'Exclusive'}):
                  </span>
                  <span className="font-bold">{formatCurrency(totals.vatAmount, invoice.currency)}</span>
                </div>
              ) : isBdt && (
                <div className="flex justify-between text-gray-400">
                  <span className="font-semibold">VAT Status:</span>
                  <span className="font-bold text-emerald-700">Not Applied (0% Exempt)</span>
                </div>
              )}

              <div className="flex justify-between border-t border-gray-200 pt-1.5 text-xs font-extrabold text-[#100e09]">
                <span>Total Payable:</span>
                <span>{formatCurrency(totals.totalPayable, invoice.currency)}</span>
              </div>

              <div className="flex justify-between text-green-600 font-semibold text-[11px]">
                <span>Amount Paid:</span>
                <span>{formatCurrency(totals.amountPaid, invoice.currency)}</span>
              </div>

              <div className="flex justify-between border-t border-gray-200 pt-1.5 text-xs font-bold text-gray-900">
                <span>Amount Due:</span>
                <span>{formatCurrency(totals.amountDue, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Full Width Bank Details & Payment Instructions Section */}
          <div className="border-t border-gray-200 pt-3 space-y-3 avoid-break">
            <span className="font-extrabold text-[10px] uppercase tracking-wider text-gray-400 block">
              PAYMENT & REMITTANCE INSTRUCTIONS
            </span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Bank Account Box */}
              {bankAccount ? (
                <div className="rounded-xl bg-gray-50 p-3 border border-gray-200/70 space-y-1 text-gray-700">
                  <div className="flex items-center space-x-1.5 text-[#100e09] font-bold text-xs mb-0.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{bankAccount.bank_name}</span>
                  </div>
                  <p className="text-[11px]"><span className="font-semibold text-gray-500">Account Holder:</span> <strong className="text-gray-900">{bankAccount.account_holder}</strong></p>
                  <p className="text-[11px]"><span className="font-semibold text-gray-500">Account Number:</span> <strong className="font-mono text-gray-900">{bankAccount.account_number}</strong></p>
                  {bankAccount.branch && <p className="text-[11px]"><span className="font-semibold text-gray-500">Branch Name:</span> <span className="text-gray-800">{bankAccount.branch}</span></p>}
                  {bankAccount.routing_number && <p className="text-[11px]"><span className="font-semibold text-gray-500">Routing Code:</span> <span className="font-mono text-gray-800">{bankAccount.routing_number}</span></p>}
                  {bankAccount.swift_bic && <p className="text-[11px]"><span className="font-semibold text-gray-500">SWIFT / BIC:</span> <span className="font-mono text-gray-800">{bankAccount.swift_bic}</span></p>}
                </div>
              ) : (
                <p className="text-gray-400 italic text-xs">No bank account details specified.</p>
              )}

              {/* Mobile Wallets & Instructions */}
              <div className="space-y-2">
                {isBdt && (entity?.bkash_merchant || entity?.nagad_merchant) && (
                  <div className="rounded-xl border border-gray-200/70 bg-gray-50 p-3 space-y-1.5">
                    <p className="font-bold text-[10px] text-gray-500 uppercase tracking-wider">Mobile Wallet (Merchant Payment)</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {entity.bkash_merchant && (
                        <div className="rounded-lg bg-[#f5f4eb] p-2 border border-gray-200/80">
                          <span className="text-[9px] font-bold text-pink-600 block uppercase">bKash Merchant</span>
                          <span className="font-mono font-extrabold text-gray-900 text-xs">{entity.bkash_merchant}</span>
                        </div>
                      )}
                      {entity.nagad_merchant && (
                        <div className="rounded-lg bg-[#f5f4eb] p-2 border border-gray-200/80">
                          <span className="text-[9px] font-bold text-orange-600 block uppercase">Nagad Merchant</span>
                          <span className="font-mono font-extrabold text-gray-900 text-xs">{entity.nagad_merchant}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {invoice.payment_instructions && (
                  <div className="rounded-xl bg-gray-50 p-3 border border-gray-200/70 text-[11px] text-gray-700 leading-relaxed italic">
                    {invoice.payment_instructions}
                  </div>
                )}
              </div>
            </div>

            {/* QR Verification Badge */}
            {verifyUrl && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-[#100e09]/20 bg-[#100e09]/5 p-2.5 avoid-break">
                <div className="flex items-center space-x-2.5">
                  <QRCodeSVG
                    value={verifyUrl}
                    size={48}
                    bgColor="#f5f4eb"
                    fgColor="#100e09"
                    level="H"
                    marginSize={1}
                  />
                  <div>
                    <div className="flex items-center space-x-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#100e09]" />
                      <span className="font-extrabold text-[#100e09] text-[11px] uppercase tracking-wider">app Authenticity Verified</span>
                    </div>
                    <p className="text-gray-600 text-[9px] leading-tight mt-0.5">
                      Scan QR code to verify digital signature on official portal.
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block text-right">
                  <span className="text-[9px] font-bold uppercase text-[#100e09] bg-[#f5f4eb] border border-[#100e09]/20 px-2 py-0.5 rounded shadow-2xs">
                    app
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Legal footer */}
          <div className="mt-4 pt-2 border-t border-gray-200 text-[9px] text-gray-500 text-center leading-normal space-y-0.5 avoid-break">
            <p className="font-bold text-[#100e09] tracking-wide">
              {entity ? entity.legal_name : (isBdt ? 'Corevow Limited' : 'Corevow LLC')}
            </p>
            <p className="text-gray-500 text-[8px]">
              {isBdt
                ? 'All rates are inclusive of applicable VAT in accordance with the prevailing laws and regulations of Bangladesh.'
                : 'All rates are inclusive of applicable taxes in accordance with the prevailing laws and regulations.'}
            </p>
            <div className="pt-1 border-t border-dashed border-gray-200 text-[8px] font-semibold text-gray-400">
              app Document • Computer-generated • No physical signature required.
            </div>
          </div>
        </div>

      </div>
      </div>
      
      <NotificationModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
      />
    </div>
  );
}
