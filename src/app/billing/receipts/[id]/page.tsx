'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, Payment, Invoice, BillingClient, BusinessEntity, localStore } from '@/lib/db';
import { calculateTotals, formatCurrency } from '@/lib/calculations';
import Link from 'next/link';
import { ArrowLeft, Printer, Sparkles } from 'lucide-react';

export default function ReceiptDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<BillingClient | null>(null);
  const [entity, setEntity] = useState<BusinessEntity | null>(null);
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReceiptData() {
      try {
        const allPays = await db.getPayments();
        const pay = allPays.find(p => p.id === id);
        if (!pay) {
          router.push('/billing/payments');
          return;
        }
        setPayment(pay);

        const inv = await db.getInvoiceById(pay.invoice_id);
        if (inv) {
          setInvoice(inv);

          // Get client
          const cl = await db.getClientById(inv.client_id);
          if (cl) setClient(cl);

          // Get entity
          const ents = await db.getEntities();
          const ent = ents.find(e => e.id === inv.entity_id);
          if (ent) setEntity(ent);

          // Calculate remaining balance after this payment date
          const items = localStore.items.filter(itm => itm.invoice_id === inv.id);
          
          // Get all payments for this invoice that happened up to this payment date
          const invPays = allPays.filter(p => p.invoice_id === inv.id && new Date(p.payment_date) <= new Date(pay.payment_date));
          const totals = calculateTotals({
            items,
            discountType: inv.discount_type,
            discountValue: inv.discount_value,
            vatRate: inv.vat_rate,
            vatInclusive: inv.vat_inclusive,
            payments: invPays
          });
          setRemainingBalance(totals.amountDue);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadReceiptData();
  }, [id, router]);

  if (loading || !payment || !invoice || !client || !entity) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-55">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  const handlePrint = () => {
    const originalTitle = document.title;
    if (payment?.receipt_number) {
      document.title = `Receipt_${payment.receipt_number.replace(/[\/\\?%*:|"<>]/g, '-')}`;
    } else {
      document.title = 'app_Receipt';
    }
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 no-print-bg">
      
      {/* Controls header */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center bg-[#f5f4eb] border border-gray-100 p-4 rounded-2xl shadow-sm no-print">
        <Link href="/billing/payments" className="inline-flex items-center space-x-2 text-xs font-semibold text-gray-550 hover:text-gray-950">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Payments Ledger</span>
        </Link>
        
        <button
          onClick={handlePrint}
          className="flex items-center space-x-1.5 rounded-lg bg-[#100e09] py-2 px-4 text-xs font-bold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-sm transition cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>Print Receipt Document</span>
        </button>
      </div>

      {/* A4 Canvas printable area */}
      <div
        id="print-area"
        className="max-w-[210mm] mx-auto bg-[#f5f4eb] shadow-lg border border-gray-100 p-12 text-[#1E1E1E] flex flex-col justify-between font-sans"
        style={{ width: '210mm', minHeight: '148mm' }} // A5 height is normally fine, but A4 scale limits
      >
        <div>
          {/* Header */}
          <div className="flex justify-between items-start pb-6 border-b border-gray-100">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/app%20logo.svg"
                alt="app"
                className="h-9 w-auto"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logos/SVG/corevow-logo.svg'; }}
              />
            </div>

            <div className="text-right">
              <h2 className="text-xl font-extrabold text-[#100e09] tracking-wider uppercase">PAYMENT RECEIPT</h2>
              <span className="text-xs font-bold text-gray-800 block mt-2">{payment.receipt_number}</span>
            </div>
          </div>

          {/* Details split */}
          <div className="grid grid-cols-2 gap-8 py-6 text-xs leading-relaxed text-gray-650 border-b border-gray-100">
            <div className="space-y-1.5">
              <span className="font-bold text-gray-400 uppercase tracking-wider block text-[9px]">RECEIVED FROM:</span>
              <p className="font-extrabold text-gray-800 text-sm">{client.company_name || client.contact_person}</p>
              <p>{client.billing_address}</p>
              <p>{client.city}, {client.country}</p>
            </div>
            
            <div className="space-y-1.5">
              <span className="font-bold text-gray-400 uppercase tracking-wider block text-[9px]">ISSUED BY LEGAL ENTITY:</span>
              <p className="font-extrabold text-gray-800 text-sm">{entity.legal_name}</p>
              <p>{entity.registered_address}</p>
              <p>Registration: {entity.registration_number}</p>
              <p>Tax / EIN: {entity.tax_id}</p>
            </div>
          </div>

          {/* Receipt parameters list */}
          <div className="py-6 border-b border-gray-100 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-450">Transaction Specifics</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Payment Date:</span>
                <span className="font-semibold">{payment.payment_date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Invoice Reference #:</span>
                <span className="font-bold text-[#100e09]">{invoice.invoice_number || 'Draft'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Payment Method:</span>
                <span className="font-semibold">{payment.payment_method}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Transaction Reference ID:</span>
                <span className="font-semibold">{payment.transaction_reference || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Amount Received:</span>
                <span className="font-extrabold text-green-600">{formatCurrency(payment.amount, payment.currency)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Remaining Balance:</span>
                <span className="font-bold text-gray-800">{formatCurrency(remainingBalance, payment.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signature & Disclosures */}
        <div className="mt-12">
          <div className="flex justify-between items-end">
            <div className="text-[8px] text-gray-400 leading-normal max-w-sm">
              <p className="font-bold text-gray-500 uppercase tracking-wide">app Billing Disclosure</p>
              <p className="mt-1">This official document validates that payment has been successfully recorded in the financial books of the respective app legal entity.</p>
            </div>
            
            {/* Signature placeholder */}
            <div className="w-40 border-t border-gray-300 text-center pt-2">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Authorized Signatory</span>
              <span className="text-[8px] text-gray-300 italic block mt-0.5">app Billing</span>
            </div>
          </div>

          <div className="mt-8 text-center text-[7px] text-gray-400 border-t border-gray-100 pt-4 leading-normal">
            <p className="font-bold text-[#100e09] tracking-wider">{entity.legal_name}</p>
            <p className="mt-0.5">This document does not represent a credit note. Unsettled balance due is subject to standard service terms.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
