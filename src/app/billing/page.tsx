'use client';

import { useState, useEffect } from 'react';
import { db, Invoice, Payment, BillingClient, Profile, localStore, GatewayRates, CustomGateway } from '@/lib/db';
import { calculateTotals, formatCurrency } from '@/lib/calculations';
import Link from 'next/link';
import {
  FilePlus,
  UserPlus,
  CircleDollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowUpRight,
  TrendingDown,
  CalendarDays,
  FileText
} from 'lucide-react';

type DateFilter = 'this-month' | 'last-month' | 'this-quarter' | 'this-year' | 'all';

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [loading, setLoading] = useState(true);

  // Financial Stats States
  const [bdtStats, setBdtStats] = useState({ invoiced: 0, collected: 0, outstanding: 0, overdue: 0 });
  const [usdStats, setUsdStats] = useState({ invoiced: 0, collected: 0, outstanding: 0, overdue: 0 });
  const [bdtPlatformFee, setBdtPlatformFee] = useState(0);
  const [usdPlatformFee, setUsdPlatformFee] = useState(0);

  // Platform Fee filter states
  const [gatewayFilter, setGatewayFilter] = useState<string>('all');
  const [filteredBdtFee, setFilteredBdtFee] = useState(0);
  const [filteredUsdFee, setFilteredUsdFee] = useState(0);
  const [gatewayRates, setGatewayRates] = useState<GatewayRates>({
    bkash: 1.85, nagad: 1.50, card: 2.50, amex: 3.50,
    stripe: 2.90, payoneer: 2.00, wise: 0.50, customGateways: []
  });

  const getInvoiceTotal = (inv: Invoice) => {
    const items = localStore.items.filter(itm => itm.invoice_id === inv.id);
    if (items.length === 0) return inv.total_payable || 0;
    const totals = calculateTotals({
      items,
      discountType: inv.discount_type,
      discountValue: inv.discount_value,
      vatRate: inv.vat_rate,
      vatInclusive: inv.vat_inclusive,
      payments: []
    });
    return totals.totalPayable || inv.total_payable || 0;
  };

  useEffect(() => {
    async function loadData() {
      try {
        const user = await db.getCurrentUser();
        setCurrentUser(user);
        
        const allInvoices = await db.getInvoices();
        const allPayments = await db.getPayments();
        const allClients = await db.getClients();

        setInvoices(allInvoices);
        setPayments(allPayments);
        setClients(allClients);

        const rates = await db.getGatewayRates();
        setGatewayRates(rates);
      } catch (err) {
        console.error('Error loading dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    // Recalculate stats when dateFilter or invoices/payments change
    calculateFinancials();
  }, [dateFilter, invoices, payments]);

  const calculateFinancials = () => {
    const now = new Date();
    
    // Filter records by date range
    const filterByDate = (dateStr: string) => {
      const recordDate = new Date(dateStr);
      if (dateFilter === 'this-month') {
        return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'last-month') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return recordDate.getMonth() === lastMonth && recordDate.getFullYear() === lastMonthYear;
      }
      if (dateFilter === 'this-quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const recordQuarter = Math.floor(recordDate.getMonth() / 3);
        return recordQuarter === currentQuarter && recordDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'this-year') {
        return recordDate.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    };

    let bdtInvoiced = 0;
    let bdtCollected = 0;
    let bdtOutstanding = 0;
    let bdtOverdue = 0;

    let usdInvoiced = 0;
    let usdCollected = 0;
    let usdOutstanding = 0;
    let usdOverdue = 0;

    // 1. Calculate Invoiced & Outstanding & Overdue amounts
    invoices.forEach(inv => {
      if (inv.status === 'draft' || inv.status === 'pending_approval' || inv.status === 'void') return;
      if (!filterByDate(inv.issue_date)) return;

      const items = localStore.items.filter(itm => itm.invoice_id === inv.id);
      const invPayments = payments.filter(p => p.invoice_id === inv.id);
      const paidSum = invPayments.reduce((s, p) => s + (p.amount || 0), 0);
      let invTotal = inv.total_payable || 0;
      let amountDue = Math.max(0, invTotal - paidSum);

      if (items.length > 0) {
        const totals = calculateTotals({
          items,
          discountType: inv.discount_type,
          discountValue: inv.discount_value,
          vatRate: inv.vat_rate,
          vatInclusive: inv.vat_inclusive,
          payments: invPayments
        });
        invTotal = totals.totalPayable;
        amountDue = totals.amountDue;
      }

      const isOverdue = new Date(inv.due_date) < now && inv.status !== 'paid' && amountDue > 0;

      if (inv.currency === 'BDT') {
        bdtInvoiced += invTotal;
        bdtOutstanding += amountDue;
        if (isOverdue) bdtOverdue += amountDue;
      } else {
        usdInvoiced += invTotal;
        usdOutstanding += amountDue;
        if (isOverdue) usdOverdue += amountDue;
      }
    });

    let bdtPlatformFeeAmount = 0;
    let usdPlatformFeeAmount = 0;

    // 2. Calculate Collected amounts
    payments.forEach(pay => {
      if (!filterByDate(pay.payment_date)) return;

      const fee = pay.processing_fee || 0;
      if (pay.currency === 'BDT') {
        bdtCollected += pay.amount;
        bdtPlatformFeeAmount += fee;
      } else {
        usdCollected += pay.amount;
        usdPlatformFeeAmount += fee;
      }
    });

    setBdtStats({ invoiced: bdtInvoiced, collected: bdtCollected, outstanding: bdtOutstanding, overdue: bdtOverdue });
    setUsdStats({ invoiced: usdInvoiced, collected: usdCollected, outstanding: usdOutstanding, overdue: usdOverdue });
    setBdtPlatformFee(bdtPlatformFeeAmount);
    setUsdPlatformFee(usdPlatformFeeAmount);
  };

  // Dynamic filter for gateway platform fees
  useEffect(() => {
    let bdtFeeTotal = 0;
    let usdFeeTotal = 0;

    payments.forEach(pay => {
      // Apply date filter
      const recordDate = new Date(pay.payment_date);
      const now = new Date();
      let matchDate = true;
      if (dateFilter === 'this-month') {
        matchDate = recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'last-month') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        matchDate = recordDate.getMonth() === lastMonth && recordDate.getFullYear() === lastMonthYear;
      } else if (dateFilter === 'this-quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const recordQuarter = Math.floor(recordDate.getMonth() / 3);
        matchDate = recordQuarter === currentQuarter && recordDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'this-year') {
        matchDate = recordDate.getFullYear() === now.getFullYear();
      }

      if (!matchDate) return;

      // Apply gateway filter
      const method = (pay.payment_method || '').toLowerCase();
      const gateway = (pay.bank_gateway || '').toLowerCase();
      let matchGateway = true;

      if (gatewayFilter !== 'all') {
        if (gatewayFilter === 'bkash') {
          matchGateway = method.includes('bkash') || gateway === 'bkash';
        } else if (gatewayFilter === 'nagad') {
          matchGateway = method.includes('nagad') || gateway === 'nagad';
        } else if (gatewayFilter === 'card') {
          matchGateway = method.includes('card') || method.includes('amex') || gateway === 'card' || gateway === 'amex';
        } else if (gatewayFilter === 'stripe') {
          matchGateway = method.includes('stripe') || gateway === 'stripe';
        } else if (gatewayFilter === 'wise') {
          matchGateway = method.includes('wise') || gateway === 'wise';
        } else if (gatewayFilter === 'payoneer') {
          matchGateway = method.includes('payoneer') || gateway === 'payoneer';
        } else {
          // Custom gateway — match by id key
          const cg = (gatewayRates.customGateways || []).find(c => c.id === gatewayFilter);
          if (cg) {
            matchGateway = method.includes(cg.name.toLowerCase()) || gateway === cg.name.toLowerCase();
          } else {
            matchGateway = method.includes(gatewayFilter) || gateway === gatewayFilter;
          }
        }
      }

      if (!matchGateway) return;

      const fee = pay.processing_fee || 0;
      if (pay.currency === 'BDT') {
        bdtFeeTotal += fee;
      } else {
        usdFeeTotal += fee;
      }
    });

    setFilteredBdtFee(bdtFeeTotal);
    setFilteredUsdFee(usdFeeTotal);
  }, [gatewayFilter, dateFilter, payments]);

  const getGatewayDistribution = () => {
    // Built-in gateways
    const builtInMap: Record<string, { bdtFee: number; usdFee: number; label: string; color: string }> = {
      bkash:    { bdtFee: 0, usdFee: 0, label: 'bKash',      color: 'bg-pink-500' },
      nagad:    { bdtFee: 0, usdFee: 0, label: 'Nagad',      color: 'bg-orange-500' },
      card:     { bdtFee: 0, usdFee: 0, label: 'Card/AMEX',  color: 'bg-blue-600' },
      stripe:   { bdtFee: 0, usdFee: 0, label: 'Stripe',     color: 'bg-[#635BFF]' },
      wise:     { bdtFee: 0, usdFee: 0, label: 'Wise',       color: 'bg-teal-500' },
      payoneer: { bdtFee: 0, usdFee: 0, label: 'Payoneer',   color: 'bg-sky-500' },
    };

    // Custom gateways map
    const customMap: Record<string, { bdtFee: number; usdFee: number; label: string; color: string }> = {};
    (gatewayRates.customGateways || []).forEach(cg => {
      customMap[cg.id] = { bdtFee: 0, usdFee: 0, label: cg.name, color: cg.color };
    });

    payments.forEach(pay => {
      const recordDate = new Date(pay.payment_date);
      const now = new Date();
      let matchDate = true;
      if (dateFilter === 'this-month') {
        matchDate = recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'last-month') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        matchDate = recordDate.getMonth() === lastMonth && recordDate.getFullYear() === lastMonthYear;
      } else if (dateFilter === 'this-quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const recordQuarter = Math.floor(recordDate.getMonth() / 3);
        matchDate = recordQuarter === currentQuarter && recordDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'this-year') {
        matchDate = recordDate.getFullYear() === now.getFullYear();
      }
      if (!matchDate) return;

      const fee = pay.processing_fee || 0;
      if (fee <= 0) return;

      const method = (pay.payment_method || '').toLowerCase();
      const gateway = (pay.bank_gateway || '').toLowerCase();

      // Try matching custom gateways first
      let matched = false;
      for (const cg of (gatewayRates.customGateways || [])) {
        if (method.includes(cg.name.toLowerCase()) || gateway === cg.name.toLowerCase() || gateway === cg.id.toLowerCase()) {
          if (pay.currency === 'BDT') customMap[cg.id].bdtFee += fee;
          else customMap[cg.id].usdFee += fee;
          matched = true;
          break;
        }
      }

      if (!matched) {
        if (method.includes('bkash') || gateway === 'bkash') {
          if (pay.currency === 'BDT') builtInMap.bkash.bdtFee += fee; else builtInMap.bkash.usdFee += fee;
        } else if (method.includes('nagad') || gateway === 'nagad') {
          if (pay.currency === 'BDT') builtInMap.nagad.bdtFee += fee; else builtInMap.nagad.usdFee += fee;
        } else if (method.includes('card') || method.includes('amex') || gateway === 'card' || gateway === 'amex') {
          if (pay.currency === 'BDT') builtInMap.card.bdtFee += fee; else builtInMap.card.usdFee += fee;
        } else if (method.includes('stripe') || gateway === 'stripe') {
          if (pay.currency === 'BDT') builtInMap.stripe.bdtFee += fee; else builtInMap.stripe.usdFee += fee;
        } else if (method.includes('wise') || gateway === 'wise') {
          if (pay.currency === 'BDT') builtInMap.wise.bdtFee += fee; else builtInMap.wise.usdFee += fee;
        } else if (method.includes('payoneer') || gateway === 'payoneer') {
          if (pay.currency === 'BDT') builtInMap.payoneer.bdtFee += fee; else builtInMap.payoneer.usdFee += fee;
        }
      }
    });

    // Merge all into sorted arrays
    const allEntries = [
      ...Object.values(builtInMap),
      ...Object.values(customMap)
    ];

    const totalBDT = allEntries.reduce((s, e) => s + e.bdtFee, 0) || 1;
    const totalUSD = allEntries.reduce((s, e) => s + e.usdFee, 0) || 1;

    const bdt = allEntries
      .map(e => ({ label: e.label, amount: e.bdtFee, percent: (e.bdtFee / totalBDT) * 100, color: e.color }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const usd = allEntries
      .map(e => ({ label: e.label, amount: e.usdFee, percent: (e.usdFee / totalUSD) * 100, color: e.color }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return { bdt, usd };
  };

  const getClientName = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    return c ? (c.company_name || c.contact_person) : 'Client';
  };

  const getRecentInvoices = () => {
    return invoices
      .filter(i => i.status !== 'draft')
      .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime())
      .slice(0, 5);
  };

  const getDraftInvoices = () => {
    return invoices
      .filter(i => i.status === 'draft')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  };

  const getOverdueInvoices = () => {
    const now = new Date();
    return invoices
      .filter(i => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft' && new Date(i.due_date) < now)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
  };

  const getRecentPayments = () => {
    return payments
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 5);
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  const isViewer = false;
  const isPM = currentUser?.role_name === 'Project Manager';
  const isCS = currentUser?.role_name === 'Client Service';

  return (
    <div className="space-y-8">
      
      {/* Top Welcome Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Billing Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time financial metrics for Corevow Limited (BDT) & Corevow LLC (USD)
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center space-x-2 bg-[#f5f4eb] border border-gray-100 p-1.5 rounded-xl w-full sm:w-auto">
          <CalendarDays className="h-4 w-4 text-gray-450 ml-2" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="flex-1 sm:flex-none text-sm bg-transparent border-0 font-semibold focus:outline-none focus:ring-0 cursor-pointer pr-8"
          >
            <option value="all">All-time Records</option>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="this-quarter">This Quarter</option>
            <option value="this-year">This Year</option>
          </select>
        </div>
      </div>

      {/* Quick Action Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {!isViewer && (
          <Link
            href="/billing/invoices/new"
            className="flex items-center space-x-3 rounded-2xl bg-[#100e09] p-4 text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md transition duration-150"
          >
            <FilePlus className="h-5 w-5 shrink-0" />
            <div className="text-left min-w-0">
              <span className="block font-bold text-sm">Create BDT / USD Invoice</span>
              <span className="text-[10px] text-red-250 truncate">Draft new transaction</span>
            </div>
          </Link>
        )}

        {!isViewer && !isPM && (
          <Link
            href="/billing/clients/new"
            className="flex items-center space-x-3 rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4 text-[#1E1E1E] hover:border-[#100e09]/30 transition duration-150"
          >
            <UserPlus className="h-6 w-6 text-[#100e09]" />
            <div className="text-left">
              <span className="block font-bold text-sm">Add New Client Profile</span>
              <span className="text-[10px] text-gray-400">Save billing particulars</span>
            </div>
          </Link>
        )}

        {!isViewer && !isPM && !isCS && (
          <Link
            href="/billing/payments"
            className="flex items-center space-x-3 rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4 text-[#1E1E1E] hover:border-[#100e09]/30 transition duration-150"
          >
            <CircleDollarSign className="h-6 w-6 text-green-600" />
            <div className="text-left">
              <span className="block font-bold text-sm">Record Manual Payment</span>
              <span className="text-[10px] text-gray-400">Register incoming bank transfer</span>
            </div>
          </Link>
        )}
      </div>

      {/* Main Ledger Split (BDT vs USD) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* BDT Ledgers - Corevow Limited */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-lg font-bold text-[#100e09] flex items-center space-x-2">
              <span>Corevow Limited (Bangladesh)</span>
              <span className="text-xs bg-red-50 text-[#100e09] px-2 py-0.5 rounded font-semibold">BDT ৳</span>
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4">
              <div className="flex justify-between items-start text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Invoiced</span>
                <TrendingUp className="h-4 w-4 text-gray-400" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight">{formatCurrency(bdtStats.invoiced, 'BDT')}</p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4">
              <div className="flex justify-between items-start text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Collected</span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-green-600">
                {formatCurrency(bdtStats.collected, 'BDT')}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4">
              <div className="flex justify-between items-start text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Outstanding</span>
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-blue-600">
                {formatCurrency(bdtStats.outstanding, 'BDT')}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4">
              <div className="flex justify-between items-start text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-[#100e09]">
                {formatCurrency(bdtStats.overdue, 'BDT')}
              </p>
            </div>
          </div>
        </div>

        {/* USD Ledgers - Corevow LLC */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-lg font-bold text-[#100e09] flex items-center space-x-2">
              <span>Corevow LLC (United States)</span>
              <span className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-semibold">USD $</span>
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4">
              <div className="flex justify-between items-start text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Invoiced</span>
                <TrendingUp className="h-4 w-4 text-gray-400" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight">{formatCurrency(usdStats.invoiced, 'USD')}</p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4">
              <div className="flex justify-between items-start text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Collected</span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-green-600">
                {formatCurrency(usdStats.collected, 'USD')}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4">
              <div className="flex justify-between items-start text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Outstanding</span>
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-blue-600">
                {formatCurrency(usdStats.outstanding, 'USD')}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-4">
              <div className="flex justify-between items-start text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-[#100e09]">
                {formatCurrency(usdStats.overdue, 'USD')}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Platform / Gateway Cutoff Fee Monitor Section */}
      <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-50 pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#100e09] flex items-center space-x-2">
              <span>Platform / Gateway Cutoff Fee Monitor</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Auto-deducted platform expenses across active billing channels •{' '}
              <Link href="/billing/settings/gateway-rates" className="text-[#100e09] font-bold hover:underline">
                Manage Rates →
              </Link>
            </p>
          </div>

          {/* Gateway Filter Dropdown — dynamic with custom gateways */}
          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700">
            <span>Gateway Channel:</span>
            <select
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
              className="bg-transparent border-0 font-bold focus:outline-none focus:ring-0 cursor-pointer pr-6 text-gray-800"
            >
              <option value="all">All Channels</option>
              <option value="bkash">bKash Mobile Wallet</option>
              <option value="nagad">Nagad Mobile Wallet</option>
              <option value="card">Card / AMEX</option>
              <option value="stripe">Stripe</option>
              <option value="wise">Wise</option>
              <option value="payoneer">Payoneer</option>
              {(gatewayRates.customGateways || []).map(cg => (
                <option key={cg.id} value={cg.id}>{cg.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Top stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">BDT Cutoff (Filtered)</span>
            <p className="text-xl font-extrabold text-amber-700 mt-1">{formatCurrency(filteredBdtFee, 'BDT')}</p>
            <span className="text-[10px] text-gray-400 mt-0.5 block">Filtered channel expenses</span>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">USD Cutoff (Filtered)</span>
            <p className="text-xl font-extrabold text-amber-700 mt-1">{formatCurrency(filteredUsdFee, 'USD')}</p>
            <span className="text-[10px] text-gray-400 mt-0.5 block">Filtered channel expenses</span>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total BDT (All)</span>
            <p className="text-xl font-extrabold text-gray-700 mt-1">{formatCurrency(bdtPlatformFee, 'BDT')}</p>
            <span className="text-[10px] text-gray-400 mt-0.5 block">All-time cutoff total</span>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total USD (All)</span>
            <p className="text-xl font-extrabold text-gray-700 mt-1">{formatCurrency(usdPlatformFee, 'USD')}</p>
            <span className="text-[10px] text-gray-400 mt-0.5 block">All-time cutoff total</span>
          </div>
        </div>

        {/* Stacked bar charts + breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* BDT Distribution */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#100e09] uppercase tracking-wider">Bangladesh BDT Channel</span>
              <span className="text-[10px] text-gray-400">{formatCurrency(bdtPlatformFee, 'BDT')} total</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 flex overflow-hidden">
              {getGatewayDistribution().bdt.length === 0 ? (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400">No fees recorded</div>
              ) : (
                getGatewayDistribution().bdt.map((item, idx) => (
                  <div
                    key={idx}
                    className={`${item.color} h-full transition-all`}
                    style={{ width: `${item.percent}%` }}
                    title={`${item.label}: ${formatCurrency(item.amount, 'BDT')} (${item.percent.toFixed(1)}%)`}
                  />
                ))
              )}
            </div>
            {/* Per-gateway breakdown rows */}
            <div className="space-y-1.5">
              {getGatewayDistribution().bdt.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-2">No BDT cutoff data yet</p>
              ) : (
                getGatewayDistribution().bdt.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                      <span className="font-semibold text-gray-700">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`${item.color} h-full`} style={{ width: `${item.percent}%` }} />
                      </div>
                      <span className="font-bold text-amber-700 min-w-[60px] text-right">{formatCurrency(item.amount, 'BDT')}</span>
                      <span className="text-gray-400 min-w-[36px] text-right">{item.percent.toFixed(1)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* USD Distribution */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">United States USD Channel</span>
              <span className="text-[10px] text-gray-400">{formatCurrency(usdPlatformFee, 'USD')} total</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 flex overflow-hidden">
              {getGatewayDistribution().usd.length === 0 ? (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400">No fees recorded</div>
              ) : (
                getGatewayDistribution().usd.map((item, idx) => (
                  <div
                    key={idx}
                    className={`${item.color} h-full transition-all`}
                    style={{ width: `${item.percent}%` }}
                    title={`${item.label}: ${formatCurrency(item.amount, 'USD')} (${item.percent.toFixed(1)}%)`}
                  />
                ))
              )}
            </div>
            {/* Per-gateway breakdown rows */}
            <div className="space-y-1.5">
              {getGatewayDistribution().usd.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-2">No USD cutoff data yet</p>
              ) : (
                getGatewayDistribution().usd.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                      <span className="font-semibold text-gray-700">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`${item.color} h-full`} style={{ width: `${item.percent}%` }} />
                      </div>
                      <span className="font-bold text-amber-700 min-w-[60px] text-right">{formatCurrency(item.amount, 'USD')}</span>
                      <span className="text-gray-400 min-w-[36px] text-right">{item.percent.toFixed(1)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Lists Section: Recent Invoices, Drafts, Overdues, Payments */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Left Column: Recent Invoices & Drafts */}
        <div className="space-y-8">
          
          {/* Recent Finalized Invoices */}
          <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-md">Recent Finalized Invoices</h3>
              <Link href="/billing/invoices" className="text-xs font-bold text-[#100e09] flex items-center">
                <span>View all</span>
                <ArrowUpRight className="h-3 w-3 ml-0.5" />
              </Link>
            </div>
            
            <div className="divide-y divide-gray-50">
              {getRecentInvoices().length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">No finalized invoices found.</div>
              ) : (
                getRecentInvoices().map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center py-3">
                    <div className="min-w-0">
                      <Link href={`/billing/invoices/${inv.id}`} className="font-semibold text-sm hover:text-[#100e09] truncate block">
                        {inv.invoice_number}
                      </Link>
                      <span className="text-xs text-gray-450 block truncate">{getClientName(inv.client_id)} • {inv.project_name}</span>
                    </div>
                    <div className="text-right ml-4">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeColor(inv.status)} mb-1`}>
                        {inv.status}
                      </span>
                      <span className="block text-sm font-bold">{formatCurrency(getInvoiceTotal(inv), inv.currency)}</span> 
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Draft Invoices */}
          <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-md">Invoices in Draft</h3>
              <Link href="/billing/invoices" className="text-xs font-bold text-[#100e09] flex items-center">
                <span>View drafts</span>
                <ArrowUpRight className="h-3 w-3 ml-0.5" />
              </Link>
            </div>
            
            <div className="divide-y divide-gray-50">
              {getDraftInvoices().length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">No draft invoices found.</div>
              ) : (
                getDraftInvoices().map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center py-3">
                    <div className="min-w-0">
                      <Link href={`/billing/invoices/${inv.id}`} className="font-semibold text-sm hover:text-[#100e09] truncate block">
                        Draft: {inv.project_name}
                      </Link>
                      <span className="text-xs text-gray-450 block truncate">{getClientName(inv.client_id)} • Issued {inv.issue_date}</span>
                    </div>
                    <div className="text-right ml-4">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-800 mb-1">
                        draft
                      </span>
                      <Link
                        href={`/billing/invoices/${inv.id}/edit`}
                        className="block text-xs font-semibold text-[#100e09] hover:underline"
                      >
                        Edit Draft
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Overdue Invoices & Recent Payments */}
        <div className="space-y-8">
          
          {/* Overdue Invoices */}
          <div className="rounded-2xl border border-gray-100 bg-[#100e09]/5 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-md text-[#100e09] flex items-center space-x-1.5">
                <AlertCircle className="h-4 w-4" />
                <span>Overdue Unpaid Invoices</span>
              </h3>
            </div>
            
            <div className="divide-y divide-[#100e09]/10">
              {getOverdueInvoices().length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">No overdue invoices! Good job.</div>
              ) : (
                getOverdueInvoices().map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center py-3">
                    <div className="min-w-0">
                      <Link href={`/billing/invoices/${inv.id}`} className="font-semibold text-sm hover:text-[#100e09] truncate block">
                        {inv.invoice_number}
                      </Link>
                      <span className="text-xs text-gray-450 block truncate">
                        {getClientName(inv.client_id)} • Due since {inv.due_date}
                      </span>
                    </div>
                    <div className="text-right ml-4">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 mb-1">
                        overdue
                      </span>
                      <span className="block text-sm font-bold text-[#100e09]">Due: {inv.currency}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Payments Received */}
          <div className="rounded-2xl border border-gray-100 bg-[#f5f4eb] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-md">Recent Payments Received</h3>
              <Link href="/billing/payments" className="text-xs font-bold text-[#100e09] flex items-center">
                <span>View payments</span>
                <ArrowUpRight className="h-3 w-3 ml-0.5" />
              </Link>
            </div>
            
            <div className="divide-y divide-gray-50">
              {getRecentPayments().length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">No payments recorded yet.</div>
              ) : (
                getRecentPayments().map((pay) => (
                  <div key={pay.id} className="flex justify-between items-center py-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-sm block">
                        {formatCurrency(pay.amount, pay.currency)}
                      </span>
                      <span className="text-xs text-gray-455 block truncate">
                        via {pay.payment_method} • Ref: {pay.transaction_reference || 'N/A'}
                      </span>
                    </div>
                    <div className="text-right ml-4">
                      <span className="text-xs text-gray-400 block mb-1">
                        {pay.payment_date}
                      </span>
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700">
                        {pay.receipt_number}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
