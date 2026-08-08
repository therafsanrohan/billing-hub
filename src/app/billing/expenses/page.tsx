'use client';

import { useState, useEffect, useRef } from 'react';
import { db, Invoice, Payment, InvoiceItem, Expense, ExpenseCategory, BusinessEntity, Profile } from '@/lib/db';
import { calculateTotals, formatCurrency } from '@/lib/calculations';
import NotificationModal from '@/components/NotificationModal';
import {
  TrendingUp, TrendingDown, DollarSign, PlusCircle, Trash2,
  Loader2, Download, ChevronDown, AlertCircle, BarChart3,
  Wallet, Receipt, Filter, FileText, Building2
} from 'lucide-react';

type ViewMode = 'monthly' | 'yearly' | 'all';
type CurrencyTab = 'BDT' | 'USD';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Payroll', 'Office Rent', 'Utilities', 'Software & Subscriptions',
  'Marketing', 'Equipment', 'Maintenance', 'Professional Fees', 'Travel', 'Other'
];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Payroll': 'bg-blue-100 text-blue-700',
  'Office Rent': 'bg-purple-100 text-purple-700',
  'Utilities': 'bg-yellow-100 text-yellow-700',
  'Software & Subscriptions': 'bg-indigo-100 text-indigo-700',
  'Marketing': 'bg-pink-100 text-pink-700',
  'Equipment': 'bg-orange-100 text-orange-700',
  'Maintenance': 'bg-teal-100 text-teal-700',
  'Professional Fees': 'bg-cyan-100 text-cyan-700',
  'Travel': 'bg-emerald-100 text-emerald-700',
  'Other': 'bg-gray-100 text-gray-700',
};

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(max > 0 ? (value / max) * 100 : 0), 200); return () => clearTimeout(t); }, [value, max]);
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mt-1.5">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default function ExpensesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allItems, setAllItems] = useState<InvoiceItem[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [currencyTab, setCurrencyTab] = useState<CurrencyTab>('BDT');
  const [tabFilter, setTabFilter] = useState<'active' | 'pending_deletion'>('active');
  const [deleteReason, setDeleteReason] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fCategory, setFCategory] = useState<ExpenseCategory>('Payroll');
  const [fDescription, setFDescription] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fCurrency, setFCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fVendor, setFVendor] = useState('');
  const [fInvoiceRef, setFInvoiceRef] = useState('');
  const [fEntityId, setFEntityId] = useState('');

  const [modalState, setModalState] = useState<{
    isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string;
  }>({ isOpen: false, type: 'info', title: '', message: '' });
  const showNotif = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') =>
    setModalState({ isOpen: true, title, message, type });

  useEffect(() => {
    async function load() {
      try {
        const [invs, pays, ents, user, exps] = await Promise.all([
          db.getInvoices(), db.getPayments(), db.getEntities(), db.getCurrentUser(), db.getExpenses()
        ]);
        setInvoices(invs); setAllPayments(pays); setEntities(ents); setCurrentUser(user); setExpenses(exps);
        setFEntityId(ents[0]?.id || '');
        const itemLists = await Promise.all(invs.map(inv => db.getInvoiceItems(inv.id)));
        setAllItems(itemLists.flat());
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, []);

  // Date filter based on viewMode
  const matchesFilter = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    if (viewMode === 'all') return true;
    if (viewMode === 'yearly') return d.getFullYear() === selectedYear;
    if (viewMode === 'monthly') return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    return true;
  };

  // Payment Collection & Net Inflow calculation
  // NET INCOMING (Excl. VAT) is calculated from NET RECEIVED — i.e., payment amount minus
  // any gateway/processing fee already deducted. VAT is then extracted from that net figure.
  const getInflow = (currency: CurrencyTab) => {
    const relevantInvoices = invoices.filter(inv =>
      inv.currency === currency &&
      ['paid', 'partially_paid', 'sent', 'approved', 'overdue'].includes(inv.status) &&
      matchesFilter(inv.issue_date)
    );
    let totalInvoiced = 0;
    let grossCollected = 0;   // raw payment amounts (what client sent)
    let netReceived = 0;      // after gateway/processing fee deduction
    let vatFromNet = 0;       // VAT extracted from net received

    for (const inv of relevantInvoices) {
      const items = allItems.filter(i => i.invoice_id === inv.id);
      const pays = allPayments.filter(p => p.invoice_id === inv.id);
      const t = calculateTotals({
        items: items.map(i => ({ quantity: i.quantity, rate: i.rate })),
        discountType: inv.discount_type, discountValue: inv.discount_value,
        vatRate: inv.vat_rate, vatInclusive: inv.vat_inclusive, payments: pays
      });
      totalInvoiced += t.totalPayable;
      grossCollected += t.amountPaid;

      // For each payment on this invoice, compute net (after processing fee) and
      // extract the VAT portion from that net amount.
      for (const p of pays) {
        const pFee = p.processing_fee || 0;
        const pNet = Math.max(0, p.amount - pFee);
        netReceived += pNet;

        // Estimate VAT share from net received using the invoice's VAT ratio
        if (t.totalPayable > 0 && t.vatAmount > 0) {
          const vatRatio = t.vatAmount / t.totalPayable;
          vatFromNet += pNet * vatRatio;
        }
      }
    }

    // Net Incoming (Excl. VAT) = net received - VAT portion from that net
    const netIncomingRevenue = Math.max(0, netReceived - vatFromNet);
    return { totalInvoiced, grossCollected, vatCollected: vatFromNet, netIncomingRevenue };
  };

  // Filter expenses (separate active from pending deletion / archive)
  const baseFilteredExpenses = expenses.filter(e => e.currency === currencyTab && matchesFilter(e.expense_date));
  const activeExpensesList = baseFilteredExpenses.filter(e => !e.deletion_status || e.deletion_status === 'ACTIVE');
  const pendingDeletionExpensesList = baseFilteredExpenses.filter(e => e.deletion_status === 'DELETION_PENDING' || e.deletion_status === 'ARCHIVED');
  const filteredExpenses = tabFilter === 'active' ? activeExpensesList : pendingDeletionExpensesList;

  const totalExpenses = activeExpensesList.reduce((s, e) => s + e.amount, 0);
  const { totalInvoiced, grossCollected, vatCollected, netIncomingRevenue } = getInflow(currencyTab);
  
  // Profit = Net Incoming Revenue (Excl VAT) - Operating Expenses
  const grossProfit = netIncomingRevenue - totalExpenses;
  const grossMargin = netIncomingRevenue > 0 ? (grossProfit / netIncomingRevenue) * 100 : 0;
  const isProfitable = grossProfit >= 0;

  // Expenses by category
  const expensesByCategory = EXPENSE_CATEGORIES.map(cat => ({
    category: cat,
    amount: filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
  })).filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);

  const maxCategoryAmount = expensesByCategory[0]?.amount || 1;

  // Monthly breakdown (for yearly view)
  const monthlyData = (() => {
    if (viewMode !== 'yearly') return [];
    return Array.from({ length: 12 }, (_, m) => {
      const mRevInvoices = invoices.filter(inv => {
        const d = new Date(inv.issue_date);
        return inv.currency === currencyTab &&
          ['paid', 'partially_paid', 'sent', 'approved', 'overdue'].includes(inv.status) &&
          d.getFullYear() === selectedYear && d.getMonth() === m;
      });
      let rev = 0;
      for (const inv of mRevInvoices) {
        const items = allItems.filter(i => i.invoice_id === inv.id);
        const pays = allPayments.filter(p => p.invoice_id === inv.id);
        const t = calculateTotals({ items: items.map(i => ({ quantity: i.quantity, rate: i.rate })), discountType: inv.discount_type, discountValue: inv.discount_value, vatRate: inv.vat_rate, vatInclusive: inv.vat_inclusive, payments: pays });
        rev += t.totalPayable;
      }
      const exp = expenses.filter(e => e.currency === currencyTab && new Date(e.expense_date).getFullYear() === selectedYear && new Date(e.expense_date).getMonth() === m).reduce((s, e) => s + e.amount, 0);
      return { month: new Date(selectedYear, m, 1).toLocaleString('default', { month: 'short' }), revenue: rev, expenses: exp, profit: rev - exp };
    });
  })();

  const handleAddExpense = async () => {
    if (!fDescription || !fAmount || !fDate || !fVendor) {
      showNotif('Validation Error', 'Description, Amount, Date and Vendor are required.', 'error');
      return;
    }
    const amount = parseFloat(fAmount);
    if (isNaN(amount) || amount <= 0) {
      showNotif('Validation Error', 'Please enter a valid positive amount.', 'error');
      return;
    }
    try {
      setSaving(true);
      await db.addExpense({
        entity_id: fEntityId,
        category: fCategory,
        description: fDescription.trim(),
        amount,
        currency: fCurrency,
        expense_date: fDate,
        vendor: fVendor.trim(),
        invoice_ref: fInvoiceRef.trim(),
        recorded_by: currentUser?.id || ''
      });
      const refreshed = await db.getExpenses();
      setExpenses(refreshed);
      setShowAddModal(false);
      setFDescription(''); setFAmount(''); setFVendor(''); setFInvoiceRef('');
      showNotif('Expense Added', `${fCurrency === 'BDT' ? '৳' : '$'}${amount.toLocaleString()} (${fCategory}) recorded successfully.`, 'success');
    } catch (e) { showNotif('Error', 'Failed to save expense.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!deleteReason.trim()) {
      showNotif('Reason Required', 'Please enter a reason for deleting this expense.', 'error');
      return;
    }
    try {
      setSaving(true);
      await db.deleteExpense(id, deleteReason.trim(), currentUser!);
      const refreshed = await db.getExpenses();
      setExpenses(refreshed);
      setConfirmDeleteId(null);
      setDeleteReason('');
      if (currentUser?.role_name === 'Super Admin') {
        showNotif('Expense Archived', 'Expense record moved to archive with audit log saved.', 'info');
      } else {
        showNotif('Deletion Requested', 'Expense deletion request submitted for Super Admin approval.', 'success');
      }
    } catch (e: any) {
      showNotif('Error', e.message || 'Failed to process expense deletion.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveRestore = async (id: string, action: 'APPROVE_DELETE' | 'REJECT_RESTORE') => {
    if (!currentUser) return;
    try {
      setSaving(true);
      await db.approveExpenseDeletion(id, action, currentUser);
      const refreshed = await db.getExpenses();
      setExpenses(refreshed);
      showNotif(
        action === 'APPROVE_DELETE' ? 'Expense Permanently Deleted' : 'Expense Restored',
        action === 'APPROVE_DELETE' ? 'The expense record was permanently purged from the system.' : 'The expense record was restored to active status.',
        'success'
      );
    } catch (e: any) {
      showNotif('Error', e.message || 'Action failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // CSV Export
  const handleExport = () => {
    const rows = [
      ['Date', 'Category', 'Description', 'Vendor', 'Amount', 'Currency', 'Invoice Ref'],
      ...filteredExpenses.map(e => [e.expense_date, e.category, e.description, e.vendor, e.amount.toString(), e.currency, e.invoice_ref])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Expenses_${currencyTab}_${selectedYear}${viewMode === 'monthly' ? `_${selectedMonth + 1}` : ''}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <NotificationModal isOpen={modalState.isOpen} type={modalState.type} title={modalState.title} message={modalState.message} onClose={() => setModalState(s => ({ ...s, isOpen: false }))} />

      {/* Header */}
      <div className="bg-[#f5f4eb] border-b border-gray-100 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#100e09]" />
              Cashflow & P&L Tracker
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Record company cash outflow (expenses) and track profit &amp; loss against invoice revenue.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Currency */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(['BDT', 'USD'] as CurrencyTab[]).map(c => (
                <button key={c} onClick={() => setCurrencyTab(c)}
                  className={`px-4 py-2 text-xs font-bold transition cursor-pointer ${currencyTab === c ? 'bg-[#100e09] text-[#f5f4eb]' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {c === 'BDT' ? '৳ BDT' : '$ USD'}
                </button>
              ))}
            </div>
            {/* View Mode */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(['monthly', 'yearly', 'all'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-2 text-xs font-bold capitalize transition cursor-pointer ${viewMode === v ? 'bg-[#100e09] text-[#f5f4eb]' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {v}
                </button>
              ))}
            </div>
            {/* Year/Month selectors */}
            {viewMode !== 'all' && (
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {viewMode === 'monthly' && (
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer">
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}
            <button onClick={handleExport}
              className="flex items-center gap-1.5 border border-gray-200 bg-[#f5f4eb] text-gray-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition cursor-pointer">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-[#100e09] text-[#f5f4eb] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] shadow-sm transition cursor-pointer">
              <PlusCircle className="h-3.5 w-3.5" /> Add Expense
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-6">

        {/* P&L Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Net Incoming Revenue */}
          <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-green-600"><DollarSign className="h-5 w-5 text-[#f5f4eb]" /></div>
              <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Inflow</span>
            </div>
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Net Incoming (Excl. VAT)</p>
            <p className="text-2xl font-extrabold text-green-700 mt-0.5">{formatCurrency(netIncomingRevenue, currencyTab)}</p>
            <p className="text-xs text-gray-400 mt-1">Gross Paid: {formatCurrency(grossCollected, currencyTab)} · VAT (from net): {formatCurrency(vatCollected, currencyTab)}</p>
          </div>
          {/* Expenses */}
          <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-red-600"><TrendingDown className="h-5 w-5 text-[#f5f4eb]" /></div>
              <span className="text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Expenses</span>
            </div>
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-extrabold text-red-600 mt-0.5">{formatCurrency(totalExpenses, currencyTab)}</p>
            <p className="text-xs text-gray-400 mt-1">{filteredExpenses.length} expense records</p>
          </div>
          {/* Gross Profit/Loss */}
          <div className={`rounded-2xl border shadow-sm p-5 ${isProfitable ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl ${isProfitable ? 'bg-green-600' : 'bg-red-700'}`}>
                {isProfitable ? <TrendingUp className="h-5 w-5 text-[#f5f4eb]" /> : <TrendingDown className="h-5 w-5 text-[#f5f4eb]" />}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider
                ${isProfitable ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                {isProfitable ? 'Profit' : 'Loss'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Gross {isProfitable ? 'Profit' : 'Loss'}</p>
            <p className={`text-2xl font-extrabold mt-0.5 ${isProfitable ? 'text-green-700' : 'text-red-700'}`}>
              {isProfitable ? '' : '-'}{formatCurrency(Math.abs(grossProfit), currencyTab)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Revenue minus expenses</p>
          </div>
          {/* Gross Margin */}
          <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-purple-600"><BarChart3 className="h-5 w-5 text-[#f5f4eb]" /></div>
              <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Margin</span>
            </div>
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Gross Margin</p>
            <p className={`text-2xl font-extrabold mt-0.5 ${grossMargin >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
              {grossMargin.toFixed(1)}%
            </p>
            <div className="h-1.5 mt-2 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${grossMargin >= 0 ? 'bg-purple-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.abs(grossMargin))}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Breakdown */}
          <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Expenses by Category</h2>
            {expensesByCategory.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Receipt className="h-8 w-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">No expenses recorded for this period.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expensesByCategory.map(({ category, amount }) => (
                  <div key={category}>
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category]}`}>{category}</span>
                      <span className="text-xs font-extrabold text-gray-800">{formatCurrency(amount, currencyTab)}</span>
                    </div>
                    <MiniBar value={amount} max={maxCategoryAmount} color="bg-[#100e09]" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Trend (yearly view only) */}
          <div className="lg:col-span-2 bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">
              {viewMode === 'yearly' ? `Monthly P&L — ${selectedYear}` : 'Revenue vs Expenses'}
            </h2>
            {viewMode === 'yearly' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="pb-2">Month</th>
                      <th className="pb-2 text-right text-green-600">Revenue</th>
                      <th className="pb-2 text-right text-red-500">Expenses</th>
                      <th className="pb-2 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(row => (
                      <tr key={row.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 text-sm font-semibold text-gray-700">{row.month}</td>
                        <td className="py-2.5 text-sm text-right font-semibold text-green-700">{formatCurrency(row.revenue, currencyTab)}</td>
                        <td className="py-2.5 text-sm text-right font-semibold text-red-600">{formatCurrency(row.expenses, currencyTab)}</td>
                        <td className={`py-2.5 text-sm text-right font-extrabold ${row.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {row.profit >= 0 ? '' : '-'}{formatCurrency(Math.abs(row.profit), currencyTab)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="py-2.5 px-0 text-xs font-extrabold text-gray-900">Total</td>
                      <td className="py-2.5 text-xs text-right font-extrabold text-green-700">{formatCurrency(monthlyData.reduce((s, r) => s + r.revenue, 0), currencyTab)}</td>
                      <td className="py-2.5 text-xs text-right font-extrabold text-red-600">{formatCurrency(monthlyData.reduce((s, r) => s + r.expenses, 0), currencyTab)}</td>
                      <td className={`py-2.5 text-xs text-right font-extrabold ${monthlyData.reduce((s, r) => s + r.profit, 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(monthlyData.reduce((s, r) => s + r.profit, 0)), currencyTab)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="flex items-center gap-6 p-6 rounded-xl bg-gray-50">
                <div className="flex-1 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Net Incoming Revenue</span><span className="font-bold text-green-700">{formatCurrency(netIncomingRevenue, currencyTab)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Expenses</span><span className="font-bold text-red-600">{formatCurrency(totalExpenses, currencyTab)}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-2"><span className="font-semibold text-gray-700">Net {isProfitable ? 'Profit' : 'Loss'}</span><span className={`font-extrabold ${isProfitable ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(Math.abs(grossProfit), currencyTab)}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expense Ledger Table */}
        <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-gray-100 gap-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Expense Ledger & Audit System</h2>
              <p className="text-xs text-gray-400 mt-0.5">{filteredExpenses.length} records for the selected view.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setTabFilter('active')}
                  className={`px-3 py-1.5 rounded-lg transition ${tabFilter === 'active' ? 'bg-[#100e09] text-[#f5f4eb] shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Active ({activeExpensesList.length})
                </button>
                <button
                  onClick={() => setTabFilter('pending_deletion')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${tabFilter === 'pending_deletion' ? 'bg-[#100e09] text-[#f5f4eb] shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <span>Archive & Deletion Requests</span>
                  {pendingDeletionExpensesList.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tabFilter === 'pending_deletion' ? 'bg-[#f5f4eb] text-[#100e09]' : 'bg-amber-500 text-[#f5f4eb]'}`}>
                      {pendingDeletionExpensesList.length}
                    </span>
                  )}
                </button>
              </div>

              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 bg-[#100e09] text-[#f5f4eb] px-3 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] shadow-sm transition cursor-pointer">
                <PlusCircle className="h-3.5 w-3.5" /> Add Expense
              </button>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-400">
                {tabFilter === 'active' ? 'No active expenses recorded for this period' : 'No pending expense deletion requests or archived expenses'}
              </p>
              {tabFilter === 'active' && (
                <button onClick={() => setShowAddModal(true)} className="mt-3 text-xs font-bold text-[#100e09] hover:underline cursor-pointer">
                  Record your first expense →
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    {tabFilter === 'pending_deletion' && <th className="py-3 px-4">Deletion Reason</th>}
                    {tabFilter === 'pending_deletion' && <th className="py-3 px-4">Status</th>}
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredExpenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)).map(exp => (
                    <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                      <td className="py-3 px-4 text-sm text-gray-600">{exp.expense_date}</td>
                      <td className="py-3 px-4"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category]}`}>{exp.category}</span></td>
                      <td className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate">{exp.description}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">{exp.vendor}</td>
                      <td className="py-3 px-4 text-sm font-extrabold text-gray-900 text-right">{formatCurrency(exp.amount, exp.currency)}</td>
                      {tabFilter === 'pending_deletion' && (
                        <td className="py-3 px-4 text-xs text-rose-700 italic max-w-[200px] truncate">
                          {exp.deletion_reason || 'No reason provided'}
                        </td>
                      )}
                      {tabFilter === 'pending_deletion' && (
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            exp.deletion_status === 'DELETION_PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>
                            {exp.deletion_status === 'DELETION_PENDING' ? 'DELETION PENDING' : 'ARCHIVED'}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4 text-right">
                        {tabFilter === 'active' ? (
                          <button
                            onClick={() => { setConfirmDeleteId(exp.id); setDeleteReason(''); }}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition cursor-pointer p-1"
                            title="Request Expense Deletion"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          currentUser?.role_name === 'Super Admin' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveRestore(exp.id, 'APPROVE_DELETE')}
                                className="bg-red-600 text-[#f5f4eb] text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-red-700 transition cursor-pointer"
                              >
                                Purge Permanently
                              </button>
                              <button
                                onClick={() => handleApproveRestore(exp.id, 'REJECT_RESTORE')}
                                className="bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                              >
                                Restore
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">Pending Super Admin Review</span>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-50">
              {[...filteredExpenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)).map(exp => (
                <div key={exp.id} className="px-4 py-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{exp.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{exp.vendor}</p>
                      {exp.deletion_reason && (
                        <p className="text-xs text-rose-600 italic mt-1">Reason: {exp.deletion_reason}</p>
                      )}
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-sm font-extrabold text-gray-900">{formatCurrency(exp.amount, exp.currency)}</p>
                      <p className="text-[10px] text-gray-400">{exp.expense_date}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category]}`}>{exp.category}</span>
                    {tabFilter === 'active' ? (
                      <button onClick={() => { setConfirmDeleteId(exp.id); setDeleteReason(''); }}
                        className="text-red-400 hover:text-red-600 transition cursor-pointer p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      currentUser?.role_name === 'Super Admin' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveRestore(exp.id, 'APPROVE_DELETE')} className="text-xs font-bold text-red-600">Purge</button>
                          <button onClick={() => handleApproveRestore(exp.id, 'REJECT_RESTORE')} className="text-xs font-bold text-gray-600">Restore</button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f5f4eb] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-extrabold text-gray-900">Add Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Entity */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Entity</label>
                <select value={fEntityId} onChange={e => setFEntityId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#100e09]/30">
                  {entities.map(e => <option key={e.id} value={e.id}>{e.legal_name}</option>)}
                </select>
              </div>
              {/* Category */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Category</label>
                <select value={fCategory} onChange={e => setFCategory(e.target.value as ExpenseCategory)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#100e09]/30">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Description */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Description</label>
                <input type="text" value={fDescription} onChange={e => setFDescription(e.target.value)} placeholder="e.g. Office rent payment June 2026"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#100e09]/30" />
              </div>
              {/* Vendor */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Vendor / Payee</label>
                <input type="text" value={fVendor} onChange={e => setFVendor(e.target.value)} placeholder="e.g. BRAC Bank, Figma Inc."
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#100e09]/30" />
              </div>
              {/* Amount + Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Amount</label>
                  <input type="number" min="0" step="0.01" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#100e09]/30" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Currency</label>
                  <select value={fCurrency} onChange={e => setFCurrency(e.target.value as 'BDT' | 'USD')}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#100e09]/30">
                    <option value="BDT">BDT ৳</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
              </div>
              {/* Date */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Expense Date</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#100e09]/30" />
              </div>
              {/* Invoice Ref (optional) */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Invoice / Bill Ref <span className="font-normal text-gray-400">(optional)</span></label>
                <input type="text" value={fInvoiceRef} onChange={e => setFInvoiceRef(e.target.value)} placeholder="e.g. BILL-2026-001"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#100e09]/30" />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer">Cancel</button>
              <button onClick={handleAddExpense} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#100e09] text-[#f5f4eb] text-sm font-bold hover:bg-[#7d1219] shadow-sm transition disabled:opacity-50 cursor-pointer">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deletion Request Modal with Mandatory Reason */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f5f4eb] rounded-2xl shadow-2xl w-full max-w-md p-6 text-left space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="p-2.5 rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {currentUser?.role_name === 'Super Admin' ? 'Archive Expense Record' : 'Request Expense Deletion'}
                </h3>
                <p className="text-xs text-gray-400">
                  {currentUser?.role_name === 'Super Admin'
                    ? 'State the reason for archiving this expense. Audit log will be generated.'
                    : 'Submit a deletion request for Super Admin review & approval.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Reason for Deletion <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="State the detailed reason for deleting this expense record..."
                className="w-full rounded-xl border border-gray-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#100e09]/20 font-medium"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setConfirmDeleteId(null); setDeleteReason(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRequest(confirmDeleteId)}
                disabled={saving || !deleteReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-[#f5f4eb] text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{currentUser?.role_name === 'Super Admin' ? 'Archive Expense' : 'Submit Deletion Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
