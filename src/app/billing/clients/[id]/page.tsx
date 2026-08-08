'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, BillingClient, Invoice, Payment, Profile, ClientServiceRate, localStore } from '@/lib/db';
import { calculateTotals, formatCurrency } from '@/lib/calculations';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FilePlus,
  Edit,
  Clock,
  CircleCheck,
  Calendar,
  AlertCircle,
  Sparkles,
  Trash2,
  Plus,
  Megaphone
} from 'lucide-react';

export default function ClientProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [rates, setRates] = useState<ClientServiceRate[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState<number>(0);
  const [addingRate, setAddingRate] = useState(false);

  const [client, setClient] = useState<BillingClient | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accountManager, setAccountManager] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Totals
  const [stats, setStats] = useState({
    bdtInvoiced: 0,
    bdtPaid: 0,
    bdtOutstanding: 0,
    usdInvoiced: 0,
    usdPaid: 0,
    usdOutstanding: 0
  });

  useEffect(() => {
    async function loadClientData() {
      try {
        const c = await db.getClientById(id);
        if (!c) {
          router.push('/billing/clients');
          return;
        }
        setClient(c);

        // Get manager
        const profiles = await db.getProfiles();
        const mgr = profiles.find(p => p.id === c.account_manager_id);
        if (mgr) setAccountManager(mgr);

        // Get all client invoices
        const allInvs = await db.getInvoices();
        const clientInvs = allInvs.filter(i => i.client_id === id);
        setInvoices(clientInvs);

        // Get client payments
        const allPays = await db.getPayments();
        const invoiceIds = clientInvs.map(i => i.id);
        const clientPays = allPays.filter(p => invoiceIds.includes(p.invoice_id));
        setPayments(clientPays);

        // Get client custom service rates
        const clientRatesList = await db.getClientServiceRates(id);
        setRates(clientRatesList);

        // Calculate stats
        let bdtInv = 0;
        let bdtPaidAmt = 0;
        let usdInv = 0;
        let usdPaidAmt = 0;

        clientInvs.forEach(inv => {
          if (inv.status === 'draft' || inv.status === 'void') return;
          const items = localStore.items.filter(itm => itm.invoice_id === inv.id);
          const invPays = clientPays.filter(p => p.invoice_id === inv.id);
          const totals = calculateTotals({
            items,
            discountType: inv.discount_type,
            discountValue: inv.discount_value,
            vatRate: inv.vat_rate,
            vatInclusive: inv.vat_inclusive,
            payments: invPays
          });

          if (inv.currency === 'BDT') {
            bdtInv += totals.totalPayable;
            bdtPaidAmt += totals.amountPaid;
          } else {
            usdInv += totals.totalPayable;
            usdPaidAmt += totals.amountPaid;
          }
        });

        setStats({
          bdtInvoiced: bdtInv,
          bdtPaid: bdtPaidAmt,
          bdtOutstanding: Math.max(0, bdtInv - bdtPaidAmt),
          usdInvoiced: usdInv,
          usdPaid: usdPaidAmt,
          usdOutstanding: Math.max(0, usdInv - usdPaidAmt)
        });

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadClientData();
  }, [id, router]);

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || newUnitPrice <= 0) return;
    try {
      await db.saveClientServiceRate({
        client_id: id,
        service_name: newServiceName.trim(),
        unit_price: newUnitPrice,
        unit: 'pcs'
      });
      setNewServiceName('');
      setNewUnitPrice(0);
      setAddingRate(false);
      const updated = await db.getClientServiceRates(id);
      setRates(updated);
    } catch (err) {
      console.error('Error saving client rate:', err);
    }
  };

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm('Remove this custom rate preset for this client?')) return;
    try {
      await db.deleteClientServiceRate(rateId);
      const updated = await db.getClientServiceRates(id);
      setRates(updated);
    } catch (err) {
      console.error('Error deleting client rate:', err);
    }
  };

  const getStatusBadgeColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'sent': return 'bg-purple-100 text-purple-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-cyan-100 text-cyan-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'void': return 'bg-gray-200 text-gray-500 line-through';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInvoiceTotal = (inv: Invoice) => {
    const items = localStore.items.filter(itm => itm.invoice_id === inv.id);
    const totals = calculateTotals({
      items,
      discountType: inv.discount_type,
      discountValue: inv.discount_value,
      vatRate: inv.vat_rate,
      vatInclusive: inv.vat_inclusive,
      payments: []
    });
    return totals.totalPayable;
  };

  if (loading || !client) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Link href="/billing/clients" className="inline-flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Clients Directory</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <Link
            href={`/billing/clients/${client.id}/edit`}
            className="flex items-center space-x-1.5 rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-4 text-xs font-semibold hover:bg-gray-50 transition"
          >
            <Edit className="h-3.5 w-3.5" />
            <span>Edit Profile</span>
          </Link>
          <Link
            href={`/billing/invoices/new?clientId=${client.id}`}
            className="flex items-center space-x-1.5 rounded-lg bg-[#100e09] py-2 px-4 text-xs font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-sm transition"
          >
            <FilePlus className="h-3.5 w-3.5" />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Info card left, Financials right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Card Info */}
        <div className="lg:col-span-1 bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 space-y-6">
          <div>
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold text-gray-500 mb-2">
              {client.client_type} Account
            </span>
            <h1 className="text-2xl font-bold text-[#1E1E1E] leading-tight">
              {client.company_name || client.contact_person}
            </h1>
            {client.company_name && (
              <p className="text-sm text-gray-450 mt-1">Contact: {client.contact_person}</p>
            )}
          </div>

          <div className="space-y-3.5 text-xs border-t border-gray-50 pt-4">
            <div className="flex items-center space-x-2.5">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-gray-400 font-semibold block uppercase">Billing Email</span>
                <span className="font-semibold text-gray-800 truncate block">{client.billing_email}</span>
              </div>
            </div>

            {client.additional_emails.length > 0 && (
              <div className="flex items-start space-x-2.5">
                <Mail className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-gray-400 font-semibold block uppercase">CC Invoice Emails</span>
                  <span className="text-gray-600 block leading-normal">
                    {client.additional_emails.join(', ')}
                  </span>
                </div>
              </div>
            )}

            {client.phone && (
              <div className="flex items-center space-x-2.5">
                <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-400 font-semibold block uppercase">Telephone</span>
                  <span className="font-semibold text-gray-800">{client.phone}</span>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-2.5">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-gray-400 font-semibold block uppercase">Billing Address</span>
                <span className="text-gray-600 block leading-normal whitespace-pre-line">
                  {client.billing_address}
                  {`\n`}{client.city}, {client.country}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3.5 text-xs border-t border-gray-50 pt-4">
            <div className="flex justify-between">
              <span className="text-gray-400 font-semibold">Pref. Currency:</span>
              <span className="font-bold text-gray-800">{client.preferred_currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-semibold">Payment Terms:</span>
              <span className="font-bold text-gray-800">{client.default_payment_terms}</span>
            </div>
            {client.tax_number && (
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold">Tax/VAT ID:</span>
                <span className="font-bold text-gray-800">{client.tax_number}</span>
              </div>
            )}
            {accountManager && (
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold">Account Manager:</span>
                <span className="font-bold text-gray-800">{accountManager.full_name}</span>
              </div>
            )}
          </div>

          {client.internal_note && (
            <div className="rounded-xl bg-red-50/50 p-4 border border-red-50 text-xs">
              <span className="font-bold text-[#100e09] block mb-1">Internal Note:</span>
              <p className="text-gray-600 leading-normal">{client.internal_note}</p>
            </div>
          )}

          {/* Enlisted Client Pricing Memory & Custom Service Rates */}
          <div className="rounded-2xl bg-[#f5f4eb] border border-gray-100 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center space-x-1.5">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span>Client Enlisted Service Rates</span>
              </h3>
              <button
                type="button"
                onClick={() => setAddingRate(!addingRate)}
                className="flex items-center space-x-1 text-[11px] font-bold text-[#100e09] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Rate</span>
              </button>
            </div>

            {addingRate && (
              <form onSubmit={handleAddRate} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Regular Service Name</label>
                  <input
                    type="text"
                    required
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="e.g. Static Banner Design"
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-2.5 text-xs text-[#1E1E1E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Agreed Client Price ({client.preferred_currency})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(parseFloat(e.target.value) || 0)}
                    placeholder="1300"
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-2.5 text-xs font-bold text-[#1E1E1E] focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingRate(false)}
                    className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-[#100e09] text-[#f5f4eb] text-xs font-bold hover:bg-[#7d1219]"
                  >
                    Save Rate
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {rates.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No custom rates saved yet. Rates are auto-enlisted when invoices are saved.</p>
              ) : (
                rates.map(rate => (
                  <div key={rate.id} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50 text-xs">
                    <div>
                      <span className="font-bold text-gray-800 block">{rate.service_name}</span>
                      {rate.is_paid_media && <span className="text-[9px] text-amber-700 font-semibold uppercase">Paid Media Buying</span>}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-[#100e09] text-sm">
                        {formatCurrency(rate.unit_price, client.preferred_currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRate(rate.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Delete custom rate"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ledger Summary Cards */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Outstanding split ledger summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BDT Summary */}
            <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">BDT Ledger Summary</span>
              <div className="mt-3 grid grid-cols-2 gap-4 border-t border-gray-50 pt-3">
                <div>
                  <span className="text-xs text-gray-400">Total Billed</span>
                  <p className="text-sm font-bold mt-0.5">{formatCurrency(stats.bdtInvoiced, 'BDT')}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-450">Outstanding</span>
                  <p className={`text-md font-extrabold mt-0.5 ${stats.bdtOutstanding > 0 ? 'text-[#100e09]' : 'text-gray-600'}`}>
                    {formatCurrency(stats.bdtOutstanding, 'BDT')}
                  </p>
                </div>
              </div>
            </div>

            {/* USD Summary */}
            <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">USD Ledger Summary</span>
              <div className="mt-3 grid grid-cols-2 gap-4 border-t border-gray-50 pt-3">
                <div>
                  <span className="text-xs text-gray-400">Total Billed</span>
                  <p className="text-sm font-bold mt-0.5">{formatCurrency(stats.usdInvoiced, 'USD')}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-450">Outstanding</span>
                  <p className={`text-md font-extrabold mt-0.5 ${stats.usdOutstanding > 0 ? 'text-[#100e09]' : 'text-gray-600'}`}>
                    {formatCurrency(stats.usdOutstanding, 'USD')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6">
            <h3 className="font-bold text-md mb-4 flex items-center space-x-2">
              <FilePlus className="h-4.5 w-4.5 text-gray-400" />
              <span>Invoice Transaction History</span>
            </h3>

            {invoices.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No invoices generated for this client.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-bold">
                      <th className="py-3 pr-2">Invoice #</th>
                      <th className="py-3">Project</th>
                      <th className="py-3">Issued</th>
                      <th className="py-3">Due Date</th>
                      <th className="py-3">Status</th>
                      <th className="py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50/50">
                        <td className="py-3.5 pr-2 font-bold">
                          <Link href={`/billing/invoices/${inv.id}`} className="hover:text-[#100e09]">
                            {inv.invoice_number || 'Draft'}
                          </Link>
                        </td>
                        <td className="py-3.5">{inv.project_name}</td>
                        <td className="py-3.5 text-gray-500">{inv.issue_date}</td>
                        <td className="py-3.5 text-gray-500">{inv.due_date}</td>
                        <td className="py-3.5">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${getStatusBadgeColor(inv.status)}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-bold">{formatCurrency(getInvoiceTotal(inv), inv.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payments History List */}
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6">
            <h3 className="font-bold text-md mb-4 flex items-center space-x-2">
              <CircleCheck className="h-4.5 w-4.5 text-gray-400" />
              <span>Payments & Receipts Ledger</span>
            </h3>

            {payments.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No payment receipts registered.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-bold">
                      <th className="py-3">Receipt #</th>
                      <th className="py-3">Date</th>
                      <th className="py-3">Method</th>
                      <th className="py-3">Reference</th>
                      <th className="py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3.5 font-bold">{p.receipt_number}</td>
                        <td className="py-3.5 text-gray-550">{p.payment_date}</td>
                        <td className="py-3.5">{p.payment_method}</td>
                        <td className="py-3.5 text-gray-450">{p.transaction_reference || '—'}</td>
                        <td className="py-3.5 text-right font-bold text-green-600">
                          {formatCurrency(p.amount, p.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
