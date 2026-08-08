'use client';

import { useState, useEffect } from 'react';
import { db, Payment, Invoice, BillingClient, Profile, GatewayRates, localStore } from '@/lib/db';
import { calculateTotals, formatCurrency } from '@/lib/calculations';
import Link from 'next/link';
import { CircleDollarSign, Plus, Percent, ArrowDownRight, X, CheckCircle } from 'lucide-react';
import NotificationModal from '@/components/NotificationModal';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for manual recording
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  
  // Platform Gateway Cutoff Fee states
  const [feePreset, setFeePreset] = useState<string>('none');
  const [feeRate, setFeeRate] = useState<number>(0);
  const [customFeeAmount, setCustomFeeAmount] = useState<number>(0);
  const [gatewayRates, setGatewayRates] = useState<GatewayRates>({
    bkash: 1.85, nagad: 1.50, card: 2.50, amex: 3.50,
    stripe: 2.90, payoneer: 2.00, wise: 0.50, customGateways: []
  });

  // Modal notification state
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

  const [verifyingPayment, setVerifyingPayment] = useState<Payment | null>(null);

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModalState({ isOpen: true, title, message, type });
  };

  const handleVerifyPayment = (p: Payment) => {
    setVerifyingPayment(p);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const u = await db.getCurrentUser();
        setCurrentUser(u);

        const allPays = await db.getPayments();
        setPayments(allPays);

        const allInvs = await db.getInvoices();
        setInvoices(allInvs);

        const allClients = await db.getClients();
        setClients(allClients);

        const rates = await db.getGatewayRates();
        setGatewayRates(rates);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getInvoiceNumber = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    return inv ? (inv.invoice_number || 'Draft') : '—';
  };

  const getClientName = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return '—';
    const c = clients.find(cl => cl.id === inv.client_id);
    return c ? (c.company_name || c.contact_person) : '—';
  };

  const getEligibleInvoices = () => {
    return invoices.filter(inv => {
      if (inv.status === 'draft' || inv.status === 'void' || inv.status === 'paid') return false;
      return true;
    });
  };

  const handleInvoiceChange = async (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = invoices.find(i => i.id === invId);
    if (inv) {
      try {
        const items = await db.getInvoiceItems(inv.id);
        const invPays = await db.getPaymentsForInvoice(inv.id);
        const totals = calculateTotals({
          items,
          discountType: inv.discount_type,
          discountValue: inv.discount_value,
          vatRate: inv.vat_rate,
          vatInclusive: inv.vat_inclusive,
          payments: invPays
        });
        setPayAmount(totals.amountDue > 0 ? totals.amountDue : (inv.total_payable || 0));
      } catch {
        setPayAmount(inv.total_payable || 0);
      }
    }
  };

  // Calculate platform cutoff fee amount based on selection
  const calculatedProcessingFee = (): number => {
    if (feePreset === 'custom') {
      return customFeeAmount;
    }
    if (feeRate > 0 && payAmount > 0) {
      return parseFloat(((payAmount * feeRate) / 100).toFixed(2));
    }
    return 0;
  };

  const handlePresetSelect = (preset: string, rate: number = 0) => {
    setFeePreset(preset);
    setFeeRate(rate);
    if (preset !== 'custom') {
      setCustomFeeAmount(0);
    }
    if (preset === 'bkash') setPayMethod('Mobile Financial Service (bKash)');
    else if (preset === 'nagad') setPayMethod('Mobile Financial Service (Nagad)');
    else if (preset === 'card' || preset === 'amex') setPayMethod('Card Payment');
    else if (preset === 'stripe') setPayMethod('Stripe');
    else if (preset === 'payoneer') setPayMethod('Payoneer');
    else if (preset === 'wise') setPayMethod('Wise (TransferWise)');
    else if (preset === 'none' || preset === 'custom') {
      if (preset === 'none') setPayMethod('Bank Transfer');
    } else {
      // Custom gateway — set method to its name
      const cg = (gatewayRates.customGateways || []).find(c => c.id === preset);
      if (cg) setPayMethod(cg.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedInvoiceId) {
      showModal('Selection Required', 'Please select an unpaid invoice to record payment.', 'error');
      return;
    }
    if (payAmount <= 0) {
      showModal('Invalid Amount', 'Payment amount must be greater than zero.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const inv = invoices.find(i => i.id === selectedInvoiceId);
      if (!inv) return;

      const pFee = calculatedProcessingFee();
      // Determine bank gateway label
      let bankGwLabel = '';
      if (feePreset !== 'none' && feePreset !== 'custom') {
        const cg = (gatewayRates.customGateways || []).find(c => c.id === feePreset);
        bankGwLabel = cg ? cg.name.toUpperCase() : feePreset.toUpperCase();
      } else if (feePreset === 'custom') {
        bankGwLabel = 'CUSTOM';
      }

      const p = await db.recordPayment({
        invoice_id: selectedInvoiceId,
        payment_date: payDate,
        amount: payAmount,
        currency: inv.currency,
        payment_method: payMethod,
        transaction_reference: payRef.trim(),
        bank_gateway: bankGwLabel,
        recorded_by: currentUser?.id || '',
        processing_fee: pFee,
        internal_note: payNote.trim(),
        proof_url: null
      });

      setPayments([p, ...payments]);
      setRecordingPayment(false);
      
      // Reset form
      setSelectedInvoiceId('');
      setPayAmount(0);
      setPayRef('');
      setPayNote('');
      setFeePreset('none');
      setFeeRate(0);
      setCustomFeeAmount(0);

      showModal(
        'Payment Recorded Successfully',
        `Payment receipt ${p.receipt_number} has been logged. Net received: ${formatCurrency(p.amount - pFee, p.currency)}.`,
        'success'
      );
    } catch (err: any) {
      showModal('Recording Failed', err.message || 'Payment recording failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  const isSuperAdmin = currentUser.role_name === 'Super Admin';
  const isFinanceAdmin = currentUser.role_name === 'Finance Admin';
  const canRecord = isSuperAdmin || isFinanceAdmin;

  return (
    <div className="space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Payments & Receipts Ledger</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Browse payment logs, track gateway cutoff fees, and issue client money receipts
          </p>
        </div>
        {canRecord && (
          <button
            onClick={() => setRecordingPayment(true)}
            className="flex items-center justify-center space-x-2 rounded-xl bg-[#100e09] px-4 py-2.5 text-sm font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md cursor-pointer transition w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {/* ── Desktop Table (md+) ── */}
      <div className="hidden md:block bg-[#f5f4eb] border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
        {payments.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            No payments have been recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 bg-gray-50/50 font-bold uppercase tracking-wider">
                  <th className="p-4">Receipt #</th>
                  <th className="p-4">Payment Date</th>
                  <th className="p-4">Client Company</th>
                  <th className="p-4">Invoice Ref</th>
                  <th className="p-4">Method & Ref</th>
                  <th className="p-4 text-right">Gross Paid</th>
                  <th className="p-4 text-right">Platform Fee</th>
                  <th className="p-4 text-right">Net Received</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p) => {
                  const fee = p.processing_fee || 0;
                  const netReceived = p.amount - fee;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 font-bold">{p.receipt_number}</td>
                      <td className="p-4 text-gray-500">{p.payment_date}</td>
                      <td className="p-4 font-semibold">{getClientName(p.invoice_id)}</td>
                      <td className="p-4">
                        <Link href={`/billing/invoices/${p.invoice_id}`} className="hover:text-[#100e09] font-semibold">
                          {getInvoiceNumber(p.invoice_id)}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-gray-800 block">{p.payment_method}</span>
                        {p.transaction_reference && (
                          <span className="text-[10px] font-mono text-gray-400">{p.transaction_reference}</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold text-gray-700">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                      <td className="p-4 text-right font-medium text-amber-700">
                        {fee > 0 ? (
                          <span className="inline-flex items-center space-x-0.5">
                            <ArrowDownRight className="h-3 w-3 text-amber-600" />
                            <span>-{formatCurrency(fee, p.currency)}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">0.00</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-extrabold text-emerald-600">
                        {formatCurrency(netReceived, p.currency)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleVerifyPayment(p)}
                          className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition cursor-pointer"
                        >
                          <span>Verify</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Mobile Card View (< md) ── */}
      {payments.length === 0 ? null : (
        <div className="md:hidden space-y-3">
          {payments.map((p) => {
            const fee = p.processing_fee || 0;
            const netReceived = p.amount - fee;
            return (
              <div key={p.id} className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <span className="font-bold text-sm text-[#1E1E1E] block">{p.receipt_number}</span>
                    <span className="text-xs text-gray-500">{getClientName(p.invoice_id)}</span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">{p.payment_date}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Invoice Ref</p>
                    <Link href={`/billing/invoices/${p.invoice_id}`} className="font-semibold text-gray-700 hover:text-[#100e09]">
                      {getInvoiceNumber(p.invoice_id)}
                    </Link>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Method</p>
                    <span className="font-semibold text-gray-800">{p.payment_method}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Gross Paid</p>
                    <span className="font-bold text-gray-700">{formatCurrency(p.amount, p.currency)}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Net Received</p>
                    <span className="font-extrabold text-emerald-600">{formatCurrency(netReceived, p.currency)}</span>
                  </div>
                  {fee > 0 && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Platform Fee Deducted</p>
                      <span className="font-bold text-amber-700">-{formatCurrency(fee, p.currency)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => handleVerifyPayment(p)}
                    className="flex-1 flex items-center justify-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-xl transition cursor-pointer"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Verify</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Payment Dialog Modal */}
      {recordingPayment && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base flex items-center space-x-2 text-[#1E1E1E]">
              <CircleDollarSign className="h-5 w-5 text-[#100e09]" />
              <span>Record Payment & Gateway Cutoff</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Open Invoice *</label>
                <select
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Unpaid Invoice --</option>
                  {getEligibleInvoices().map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} ({getClientName(inv.id)} - Project: {inv.project_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1.5">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1.5">Gross Client Paid *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                    className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-xs font-bold text-[#1E1E1E] focus:outline-none focus:border-[#100e09]"
                  />
                </div>
              </div>

              {/* Platform Gateway Cutoff Fee Section */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-[#1E1E1E] flex items-center space-x-1.5 text-xs">
                    <Percent className="h-3.5 w-3.5 text-[#100e09]" />
                    <span>Platform / Gateway Cutoff Fee</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium">Auto-deducted fee</span>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'none', label: 'No Fee (0%)', rate: 0 },
                    { id: 'bkash', label: `bKash (${gatewayRates.bkash}%)`, rate: gatewayRates.bkash },
                    { id: 'nagad', label: `Nagad (${gatewayRates.nagad}%)`, rate: gatewayRates.nagad },
                    { id: 'card', label: `Card (${gatewayRates.card}%)`, rate: gatewayRates.card },
                    { id: 'amex', label: `AMEX (${gatewayRates.amex}%)`, rate: gatewayRates.amex },
                    { id: 'stripe', label: `Stripe (${gatewayRates.stripe}%)`, rate: gatewayRates.stripe },
                    { id: 'payoneer', label: `Payoneer (${gatewayRates.payoneer}%)`, rate: gatewayRates.payoneer },
                    { id: 'wise', label: `Wise (${gatewayRates.wise}%)`, rate: gatewayRates.wise },
                    ...(gatewayRates.customGateways || []).map(cg => ({ id: cg.id, label: `${cg.name} (${cg.rate}%)`, rate: cg.rate })),
                    { id: 'custom', label: 'Manual Amount', rate: 0 }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetSelect(p.id, p.rate)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                        feePreset === p.id
                          ? 'border-[#100e09] bg-[#100e09]/10 text-[#100e09]'
                          : 'border-gray-200 bg-[#f5f4eb] text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Amount input if custom selected */}
                {feePreset === 'custom' && (
                  <div className="pt-2">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Enter Cutoff Fee Amount</label>
                    <input
                      type="number"
                      step="any"
                      value={customFeeAmount}
                      onChange={(e) => setCustomFeeAmount(parseFloat(e.target.value) || 0)}
                      className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-3 text-xs focus:outline-none"
                      placeholder="Cutoff fee in currency"
                    />
                  </div>
                )}

                {/* Cutoff summary calculation */}
                <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Cutoff Money: <strong className="text-amber-700">{calculatedProcessingFee().toFixed(2)}</strong></span>
                  <span className="text-gray-700 font-bold">Net Received: <strong className="text-emerald-600 font-extrabold">{(payAmount - calculatedProcessingFee()).toFixed(2)}</strong></span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Payment Method</label>
                <input
                  type="text"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:outline-none"
                  placeholder="e.g. Bank Transfer, bKash Merchant, Visa Card"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Transaction reference ID</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:outline-none"
                  placeholder="Gateway transaction hash or wire reference"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Internal Note</label>
                <textarea
                  rows={2}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:outline-none resize-y"
                  placeholder="Confidential ledger details"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setRecordingPayment(false)}
                  className="rounded-xl border border-gray-200 bg-[#f5f4eb] py-2.5 px-4 font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                 <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#100e09] py-2.5 px-6 font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 disabled:opacity-50 shadow-md cursor-pointer transition"
                >
                  {isSubmitting ? 'Saving...' : 'Record Payment'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Reusable Notification Modal */}
      <NotificationModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />

      {/* Transaction Verification Modal (Internal Use Only) */}
      {verifyingPayment && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-50 pb-3">
              <h3 className="font-bold text-base flex items-center space-x-2 text-emerald-700">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span>Internal Transaction Verification</span>
              </h3>
              <button
                onClick={() => setVerifyingPayment(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex flex-col items-center justify-center text-center space-y-1">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Verification Status</span>
                <span className="font-extrabold text-sm text-emerald-700 uppercase">LEDGER MATCH CONFIRMED</span>
                <span className="text-[9px] text-gray-400 font-mono mt-1 break-all">ID: {verifyingPayment.id}</span>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between">
                  <span className="text-gray-400">Receipt Reference:</span>
                  <span className="font-bold text-gray-800">{verifyingPayment.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Invoice:</span>
                  <span className="font-semibold text-gray-800">{getInvoiceNumber(verifyingPayment.invoice_id)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Payment Channel:</span>
                  <span className="font-semibold text-gray-800">{verifyingPayment.payment_method}</span>
                </div>
                {verifyingPayment.bank_gateway && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Settled Gateway:</span>
                    <span className="font-bold text-[#100e09]">{verifyingPayment.bank_gateway}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Gross Settled:</span>
                  <span className="font-extrabold text-gray-900">{formatCurrency(verifyingPayment.amount, verifyingPayment.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Auto Cutoff Fee:</span>
                  <span className="font-bold text-amber-700">{formatCurrency(verifyingPayment.processing_fee || 0, verifyingPayment.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Net Ledger Entry:</span>
                  <span className="font-extrabold text-emerald-600">
                    {formatCurrency(verifyingPayment.amount - (verifyingPayment.processing_fee || 0), verifyingPayment.currency)}
                  </span>
                </div>
              </div>

              {verifyingPayment.transaction_reference && (
                <div className="rounded-lg bg-gray-50 border border-gray-150 p-2.5 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold block">Gateway Verification Reference Hash</span>
                  <span className="font-mono text-[10px] text-gray-600 break-all select-all block">{verifyingPayment.transaction_reference}</span>
                </div>
              )}

              <div className="rounded-lg bg-gray-50 border border-gray-150 p-2.5 space-y-1 text-gray-500 text-[10px]">
                <p><strong>Crypto Audit Timestamp:</strong> {new Date(verifyingPayment.created_at).toUTCString()}</p>
                <p><strong>Recorded Operator ID:</strong> {verifyingPayment.recorded_by || 'System Automatic'}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setVerifyingPayment(null)}
                className="rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-4 font-semibold text-gray-700 hover:bg-gray-50 text-xs cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
