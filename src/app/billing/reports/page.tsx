'use client';

import { useState, useEffect, useRef } from 'react';
import { db, Invoice, Payment, BillingClient, localStore } from '@/lib/db';
import { calculateTotals, formatCurrency } from '@/lib/calculations';
import { BarChart3, Download, Calendar, TrendingUp, CircleDollarSign, TrendingDown, AlertCircle } from 'lucide-react';

type DateFilter = 'this-month' | 'last-month' | 'this-quarter' | 'this-year' | 'all';

// Animated progress bar component
function AnimatedBar({ percent, color, delay = 0 }: { percent: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), delay + 150);
    return () => clearTimeout(t);
  }, [percent, delay]);
  return (
    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// Mini donut‑style ring progress for the currency split cards
function RingProgress({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);
  useEffect(() => { const t = setTimeout(() => setDash(pct), 200); return () => clearTimeout(t); }, [pct]);
  return (
    <svg width="56" height="56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#E5E7EB" strokeWidth="5" />
      <circle
        cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={circ - (dash / 100) * circ}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text x="28" y="32" textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{Math.round(pct)}%</text>
    </svg>
  );
}

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [loading, setLoading] = useState(true);

  const [reportData, setReportData] = useState({
    bdtInvoiced: 0, bdtCollected: 0, bdtOutstanding: 0,
    usdInvoiced: 0, usdCollected: 0, usdOutstanding: 0,
    bdtPlatformFee: 0, usdPlatformFee: 0,
    invoiceStatusCounts: {} as Record<string, number>,
    paymentMethodCounts: {} as Record<string, number>
  });

  useEffect(() => {
    async function loadData() {
      try {
        setInvoices(await db.getInvoices());
        setPayments(await db.getPayments());
        setClients(await db.getClients());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    loadData();
  }, []);

  useEffect(() => { calculateReportStats(); }, [dateFilter, invoices, payments]);

  const calculateReportStats = () => {
    const now = new Date();
    const filterByDate = (dateStr: string) => {
      const d = new Date(dateStr);
      if (dateFilter === 'this-month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (dateFilter === 'last-month') {
        const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === lm && d.getFullYear() === ly;
      }
      if (dateFilter === 'this-quarter') return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3) && d.getFullYear() === now.getFullYear();
      if (dateFilter === 'this-year') return d.getFullYear() === now.getFullYear();
      return true;
    };

    let bdtInv = 0, bdtPaid = 0, usdInv = 0, usdPaid = 0;
    const statusCounts: Record<string, number> = {};
    const methodCounts: Record<string, number> = {};

    invoices.forEach(inv => {
      if (inv.status === 'void') return;
      if (!filterByDate(inv.issue_date)) return;
      statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
      if (inv.status === 'draft' || inv.status === 'pending_approval') return;
      const invPays = payments.filter(p => p.invoice_id === inv.id);
      const paidSum = invPays.reduce((acc, p) => acc + (p.amount || 0), 0);
      const items = localStore.items.filter(itm => itm.invoice_id === inv.id);
      let invTotal = inv.total_payable || 0;
      if (items.length > 0) {
        const totals = calculateTotals({ items, discountType: inv.discount_type, discountValue: inv.discount_value, vatRate: inv.vat_rate, vatInclusive: inv.vat_inclusive, payments: invPays });
        invTotal = totals.totalPayable;
      }
      if (inv.currency === 'BDT') { bdtInv += invTotal; bdtPaid += paidSum; }
      else { usdInv += invTotal; usdPaid += paidSum; }
    });

    let bdtFee = 0, usdFee = 0;
    payments.forEach(pay => {
      if (!filterByDate(pay.payment_date)) return;
      methodCounts[pay.payment_method] = (methodCounts[pay.payment_method] || 0) + 1;
      const fee = pay.processing_fee || 0;
      if (pay.currency === 'BDT') bdtFee += fee; else usdFee += fee;
    });

    setReportData({
      bdtInvoiced: bdtInv, bdtCollected: bdtPaid, bdtOutstanding: Math.max(0, bdtInv - bdtPaid),
      usdInvoiced: usdInv, usdCollected: usdPaid, usdOutstanding: Math.max(0, usdInv - usdPaid),
      bdtPlatformFee: bdtFee, usdPlatformFee: usdFee,
      invoiceStatusCounts: statusCounts,
      paymentMethodCounts: methodCounts
    });
  };

  const getClientName = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    return c ? (c.company_name || c.contact_person) : '—';
  };

  const exportInvoicesToCSV = () => {
    const headers = ['Invoice Number', 'Client Company', 'Project Name', 'Issue Date', 'Due Date', 'Status', 'Currency', 'Total Amount'];
    const rows = invoices.map(inv => {
      const items = localStore.items.filter(itm => itm.invoice_id === inv.id);
      let invTotal = inv.total_payable || 0;
      if (items.length > 0) {
        const totals = calculateTotals({ items, discountType: inv.discount_type, discountValue: inv.discount_value, vatRate: inv.vat_rate, vatInclusive: inv.vat_inclusive, payments: [] });
        invTotal = totals.totalPayable;
      }
      return [inv.invoice_number || 'Draft', `"${getClientName(inv.client_id).replace(/"/g, '""')}"`, `"${inv.project_name.replace(/"/g, '""')}"`, inv.issue_date, inv.due_date, inv.status, inv.currency, invTotal.toFixed(2)];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `app_Invoices_Report_${dateFilter}.csv`; a.click();
  };

  const exportToExcel = () => {
    const headers = ['Invoice Number', 'Client Company', 'Project Name', 'Issue Date', 'Due Date', 'Status', 'Currency', 'Total Amount'];
    const rows = invoices.map(inv => {
      const items = localStore.items.filter(itm => itm.invoice_id === inv.id);
      let invTotal = inv.total_payable || 0;
      if (items.length > 0) {
        const totals = calculateTotals({ items, discountType: inv.discount_type, discountValue: inv.discount_value, vatRate: inv.vat_rate, vatInclusive: inv.vat_inclusive, payments: [] });
        invTotal = totals.totalPayable;
      }
      return [inv.invoice_number || 'Draft', getClientName(inv.client_id), inv.project_name, inv.issue_date, inv.due_date, inv.status, inv.currency, invTotal.toFixed(2)];
    });
    const content = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `app_Financial_Report_${dateFilter}.xls`; a.click();
  };

  const exportToPDF = () => window.print();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  const maxStatusCount = Math.max(...Object.values(reportData.invoiceStatusCounts), 1);
  const maxMethodCount = Math.max(...Object.values(reportData.paymentMethodCounts), 1);
  const totalStatusCount = Object.values(reportData.invoiceStatusCounts).reduce((a, b) => a + b, 0);

  const statusColors: Record<string, string> = {
    paid: 'bg-green-500', partially_paid: 'bg-cyan-500', sent: 'bg-purple-500',
    approved: 'bg-blue-500', pending_approval: 'bg-yellow-500', draft: 'bg-gray-400',
    overdue: 'bg-red-500', void: 'bg-gray-300'
  };
  const methodBarColors = ['bg-[#100e09]', 'bg-emerald-600', 'bg-blue-600', 'bg-amber-500', 'bg-purple-600', 'bg-cyan-600'];

  return (
    <div className="space-y-6">

      {/* ── Header bar ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Financial Reports</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Aggregate revenue data, payment channels, and audit metrics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap no-print w-full sm:w-auto">
          {/* Date Filter */}
          <div className="flex items-center space-x-2 bg-[#f5f4eb] border border-gray-100 p-1.5 rounded-xl text-xs flex-1 sm:flex-none">
            <Calendar className="h-4 w-4 text-gray-400 ml-1" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="bg-transparent border-0 font-semibold focus:outline-none cursor-pointer pr-6 text-xs"
            >
              <option value="all">All-time</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
            </select>
          </div>
          <button onClick={exportToPDF} className="flex items-center space-x-1 rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
            <Download className="h-3.5 w-3.5 text-gray-500" /><span>PDF</span>
          </button>
          <button onClick={exportToExcel} className="flex items-center space-x-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer">
            <Download className="h-3.5 w-3.5 text-emerald-600" /><span>Excel</span>
          </button>
          <button onClick={exportInvoicesToCSV} className="flex items-center space-x-1 rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
            <Download className="h-3.5 w-3.5 text-gray-500" /><span>CSV</span>
          </button>
        </div>
      </div>

      {/* ── Financial Ledger Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* BDT */}
        <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#100e09] flex items-center space-x-2">
              <CircleDollarSign className="h-4 w-4" />
              <span>Corevow Limited (BDT ৳)</span>
            </h3>
            <RingProgress value={reportData.bdtCollected} total={reportData.bdtInvoiced} color="#100e09" />
          </div>
          <div className="space-y-3 pt-3 border-t border-gray-50 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 flex items-center gap-1.5"><TrendingUp className="h-3 w-3" />Total Billed:</span>
              <span className="font-bold text-gray-800">{formatCurrency(reportData.bdtInvoiced, 'BDT')}</span>
            </div>
            <div>
              <div className="flex justify-between text-green-600 mb-1">
                <span>Revenue Collected:</span>
                <span className="font-bold">{formatCurrency(reportData.bdtCollected, 'BDT')}</span>
              </div>
              <AnimatedBar percent={reportData.bdtInvoiced > 0 ? (reportData.bdtCollected / reportData.bdtInvoiced) * 100 : 0} color="bg-green-500" />
            </div>
            <div>
              <div className="flex justify-between text-[#100e09] mb-1">
                <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />Outstanding:</span>
                <span className="font-bold">{formatCurrency(reportData.bdtOutstanding, 'BDT')}</span>
              </div>
              <AnimatedBar percent={reportData.bdtInvoiced > 0 ? (reportData.bdtOutstanding / reportData.bdtInvoiced) * 100 : 0} color="bg-[#100e09]" delay={100} />
            </div>
          </div>
        </div>

        {/* USD */}
        <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-blue-700 flex items-center space-x-2">
              <CircleDollarSign className="h-4 w-4" />
              <span>Corevow LLC (USD $)</span>
            </h3>
            <RingProgress value={reportData.usdCollected} total={reportData.usdInvoiced} color="#1D4ED8" />
          </div>
          <div className="space-y-3 pt-3 border-t border-gray-50 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 flex items-center gap-1.5"><TrendingUp className="h-3 w-3" />Total Billed:</span>
              <span className="font-bold text-gray-800">{formatCurrency(reportData.usdInvoiced, 'USD')}</span>
            </div>
            <div>
              <div className="flex justify-between text-green-600 mb-1">
                <span>Revenue Collected:</span>
                <span className="font-bold">{formatCurrency(reportData.usdCollected, 'USD')}</span>
              </div>
              <AnimatedBar percent={reportData.usdInvoiced > 0 ? (reportData.usdCollected / reportData.usdInvoiced) * 100 : 0} color="bg-blue-600" />
            </div>
            <div>
              <div className="flex justify-between text-[#100e09] mb-1">
                <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />Outstanding:</span>
                <span className="font-bold">{formatCurrency(reportData.usdOutstanding, 'USD')}</span>
              </div>
              <AnimatedBar percent={reportData.usdInvoiced > 0 ? (reportData.usdOutstanding / reportData.usdInvoiced) * 100 : 0} color="bg-[#100e09]" delay={100} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Platform Cutoff Fee Card ── */}
      <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#100e09] flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Platform / Gateway Cutoff Expenses</span>
          </h3>
          <a href="/billing/settings/gateway-rates" className="text-xs font-bold text-[#100e09] hover:underline">Manage Rates →</a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-50">
          <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-4 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">BDT Cutoff (Bangladesh)</span>
            <p className="text-2xl font-extrabold text-amber-700">{formatCurrency(reportData.bdtPlatformFee, 'BDT')}</p>
            <p className="text-[10px] text-gray-400">Total platform fees auto-deducted from BDT payments</p>
          </div>
          <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-4 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">USD Cutoff (United States)</span>
            <p className="text-2xl font-extrabold text-amber-700">{formatCurrency(reportData.usdPlatformFee, 'USD')}</p>
            <p className="text-[10px] text-gray-400">Total platform fees auto-deducted from USD payments</p>
          </div>
        </div>
      </div>

      {/* ── Dynamic Charts: Invoice Status + Payment Methods ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Invoice Status Distribution */}
        <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-800">Invoice Lifecycle Status</h3>
            <span className="text-xs text-gray-400">{totalStatusCount} total</span>
          </div>

          {Object.keys(reportData.invoiceStatusCounts).length === 0 ? (
            <p className="text-gray-400 italic text-center py-6 text-xs">No records found for this period.</p>
          ) : (
            <div className="space-y-3 text-xs">
              {/* Stacked color bar */}
              <div className="flex h-3 w-full rounded-full overflow-hidden">
                {Object.entries(reportData.invoiceStatusCounts).map(([status, count], idx) => {
                  const pct = (count / totalStatusCount) * 100;
                  return (
                    <div
                      key={status}
                      title={`${status}: ${count} (${pct.toFixed(1)}%)`}
                      className={`h-full transition-all duration-700 ease-out ${statusColors[status] || 'bg-gray-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
              {/* Individual rows */}
              {Object.entries(reportData.invoiceStatusCounts).map(([status, count], idx) => {
                const pct = (count / maxStatusCount) * 100;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColors[status] || 'bg-gray-400'}`} />
                        <span className="capitalize text-gray-700">{status.replace(/_/g, ' ')}</span>
                      </span>
                      <span className="font-bold text-gray-900">{count}</span>
                    </div>
                    <AnimatedBar percent={pct} color={statusColors[status] || 'bg-gray-400'} delay={idx * 60} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-800">Payment Channel Distribution</h3>
            <span className="text-xs text-gray-400">{Object.values(reportData.paymentMethodCounts).reduce((a,b)=>a+b,0)} transactions</span>
          </div>

          {Object.keys(reportData.paymentMethodCounts).length === 0 ? (
            <p className="text-gray-400 italic text-center py-6 text-xs">No payments recorded for this period.</p>
          ) : (
            <div className="space-y-3 text-xs">
              {/* Stacked bar */}
              <div className="flex h-3 w-full rounded-full overflow-hidden">
                {Object.entries(reportData.paymentMethodCounts).map(([method, count], idx) => {
                  const total = Object.values(reportData.paymentMethodCounts).reduce((a,b) => a+b, 0);
                  const pct = (count / total) * 100;
                  return (
                    <div
                      key={method}
                      title={`${method}: ${count} (${pct.toFixed(1)}%)`}
                      className={`h-full transition-all duration-700 ease-out ${methodBarColors[idx % methodBarColors.length]}`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
              {/* Rows */}
              {Object.entries(reportData.paymentMethodCounts).map(([method, count], idx) => {
                const pct = (count / maxMethodCount) * 100;
                return (
                  <div key={method} className="space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${methodBarColors[idx % methodBarColors.length]}`} />
                        <span className="text-gray-700">{method}</span>
                      </span>
                      <span className="font-bold text-gray-900">{count}</span>
                    </div>
                    <AnimatedBar percent={pct} color={methodBarColors[idx % methodBarColors.length]} delay={idx * 60} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
