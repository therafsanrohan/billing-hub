'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { db, Invoice, BillingClient, BusinessEntity, Profile } from '@/lib/db';
import { formatCurrency } from '@/lib/calculations';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Eye, 
  AlertCircle, 
  Trash2, 
  Archive, 
  RotateCcw, 
  ShieldAlert, 
  Filter, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  Loader2
} from 'lucide-react';

export default function InvoiceListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State initialized from URL Search Params where applicable
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  const [presetTab, setPresetTab] = useState<'active' | 'void' | 'archived' | 'all'>(
    (searchParams.get('preset') as any) || 'active'
  );
  const [sortOption, setSortOption] = useState<string>(
    searchParams.get('sort') || 'latest_created'
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') || 'all'
  );
  const [currencyFilter, setCurrencyFilter] = useState<string>(
    searchParams.get('currency') || 'all'
  );
  const [entityFilter, setEntityFilter] = useState<string>(
    searchParams.get('entity') || 'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get('search') || ''
  );
  const [debouncedSearch, setDebouncedSearch] = useState<string>(
    searchParams.get('search') || ''
  );
  const [currentPage, setCurrentPage] = useState<number>(
    parseInt(searchParams.get('page') || '1', 10)
  );

  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mobile/Tablet Filter Drawer State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);

  // Modals for Archive and Permanent Delete
  const [archiveModalInvoice, setArchiveModalInvoice] = useState<Invoice | null>(null);
  const [archiveReason, setArchiveReason] = useState<string>('');

  const [deleteModalInvoice, setDeleteModalInvoice] = useState<Invoice | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [eligibilityChecking, setEligibilityChecking] = useState<boolean>(false);
  const [eligibilityResult, setEligibilityResult] = useState<{
    eligible: boolean;
    reasons: string[];
    invoice_number?: string;
    client_name?: string;
    total_amount?: number;
    currency?: string;
    void_date?: string;
  } | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Sync URL search params
  const updateQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (presetTab !== 'active') params.set('preset', presetTab);
    if (sortOption !== 'latest_created') params.set('sort', sortOption);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (currencyFilter !== 'all') params.set('currency', currencyFilter);
    if (entityFilter !== 'all') params.set('entity', entityFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const queryString = params.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(targetUrl, { scroll: false });
  }, [presetTab, sortOption, statusFilter, currencyFilter, entityFilter, debouncedSearch, currentPage, pathname, router]);

  useEffect(() => {
    updateQueryParams();
  }, [updateQueryParams]);

  // Load User, Clients & Entities
  useEffect(() => {
    async function loadMeta() {
      try {
        const u = await db.getCurrentUser();
        setCurrentUser(u);
        const cls = await db.getClients();
        setClients(cls);
        const ents = await db.getEntities();
        setEntities(ents);
      } catch (err) {
        console.error('Meta load error:', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch Invoices with Server-side Sorting and Pagination
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await db.getInvoicesPaginated({
        page: currentPage,
        limit: 20,
        sort: sortOption,
        preset: presetTab,
        status: statusFilter,
        currency: currencyFilter,
        entityId: entityFilter,
        search: debouncedSearch,
      });

      setInvoices(res.invoices);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err: any) {
      console.error('Fetch invoices error:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to fetch invoices.' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortOption, presetTab, statusFilter, currencyFilter, entityFilter, debouncedSearch]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const getClientName = (clientId: string) => {
    const c = clients.find((cl) => cl.id === clientId);
    return c ? c.company_name || c.contact_person : 'Client';
  };

  const getStatusBadgeColor = (status: Invoice['status'], isArchived?: boolean) => {
    if (isArchived) return 'bg-purple-100 text-purple-800 border border-purple-200';
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border border-gray-200';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'approved': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'sent': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'paid': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'partially_paid': return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
      case 'overdue': return 'bg-red-100 text-red-800 border border-red-200';
      case 'void': return 'bg-slate-200 text-slate-700 line-through font-semibold';
      case 'rejected': return 'bg-rose-100 text-rose-800 border border-rose-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Archive Invoice Trigger
  const openArchiveModal = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setArchiveModalInvoice(inv);
    setArchiveReason('');
  };

  const handleConfirmArchive = async () => {
    if (!archiveModalInvoice) return;
    setActionLoading(archiveModalInvoice.id);
    try {
      const res = await db.archiveInvoice(archiveModalInvoice.id, archiveReason.trim());
      setNotification({ type: 'success', message: res.message || 'Invoice archived successfully.' });
      setArchiveModalInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to archive invoice.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Restore Archived Invoice Trigger
  const handleRestoreInvoice = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActionLoading(inv.id);
    try {
      const res = await db.restoreArchivedInvoice(inv.id);
      setNotification({ type: 'success', message: res.message || 'Invoice restored successfully.' });
      fetchInvoices();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to restore invoice.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Permanent Delete Modal Trigger
  const openPermanentDeleteModal = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteModalInvoice(inv);
    setDeleteConfirmText('');
    setDeleteReason('');
    setEligibilityChecking(true);
    setEligibilityResult(null);

    try {
      const check = await db.checkVoidInvoiceEligibility(inv.id);
      setEligibilityResult(check);
    } catch (err: any) {
      setEligibilityResult({
        eligible: false,
        reasons: [err.message || 'Could not verify dependency status'],
      });
    } finally {
      setEligibilityChecking(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteModalInvoice || !eligibilityResult?.eligible) return;
    const requiredCode = `DELETE ${deleteModalInvoice.invoice_number || 'DRAFT'}`;
    if (deleteConfirmText.trim() !== requiredCode) return;

    setActionLoading(deleteModalInvoice.id);
    try {
      const res = await db.permanentlyDeleteVoidInvoice(deleteModalInvoice.id, deleteReason.trim());
      setNotification({ type: 'success', message: res.message || 'Invoice permanently deleted.' });
      setDeleteModalInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to permanently delete invoice.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Draft Delete Action
  const handleDeleteDraft = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm(`Are you sure you want to delete draft invoice "${inv.project_name}"? This action cannot be undone.`)) return;
    setActionLoading(inv.id);
    try {
      await db.deleteInvoice(inv.id);
      setNotification({ type: 'success', message: 'Draft invoice deleted successfully.' });
      fetchInvoices();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to delete draft invoice.' });
    } finally {
      setActionLoading(null);
    }
  };

  const isSuperAdmin = currentUser?.role_name === 'Super Admin';

  return (
    <div className="space-y-5 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-md transition ${
          notification.type === 'success' ? 'bg-emerald-900 text-[#f5f4eb]' : 'bg-rose-900 text-[#f5f4eb]'
        }`}>
          <div className="flex items-center space-x-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold">{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-[#f5f4eb]/10 rounded-lg text-[#f5f4eb]/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">Invoices Ledger</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time PostgreSQL financial ledger • Showing {totalCount} records
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setIsFilterDrawerOpen(true)}
            className="md:hidden flex-1 flex items-center justify-center space-x-2 border border-gray-200 bg-[#f5f4eb] px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 text-gray-500" />
            <span>Filters & Sort</span>
          </button>

          <Link
            href="/billing/invoices/new"
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 rounded-xl bg-[#100e09] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* Quick Filter Preset Tabs */}
      <div className="flex items-center border-b border-gray-200 overflow-x-auto gap-2 text-xs font-semibold text-gray-600 no-scrollbar">
        <button
          onClick={() => { setPresetTab('active'); setStatusFilter('all'); setCurrentPage(1); }}
          className={`pb-3 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            presetTab === 'active' ? 'border-[#100e09] text-[#100e09] font-bold' : 'border-transparent hover:text-gray-900'
          }`}
        >
          Active Records
        </button>
        <button
          onClick={() => { setPresetTab('void'); setStatusFilter('all'); setCurrentPage(1); }}
          className={`pb-3 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            presetTab === 'void' ? 'border-[#100e09] text-[#100e09] font-bold' : 'border-transparent hover:text-gray-900'
          }`}
        >
          Void Invoices
        </button>
        <button
          onClick={() => { setPresetTab('archived'); setStatusFilter('all'); setCurrentPage(1); }}
          className={`pb-3 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            presetTab === 'archived' ? 'border-[#100e09] text-[#100e09] font-bold' : 'border-transparent hover:text-gray-900'
          }`}
        >
          Archived Invoices
        </button>
        <button
          onClick={() => { setPresetTab('all'); setStatusFilter('all'); setCurrentPage(1); }}
          className={`pb-3 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            presetTab === 'all' ? 'border-[#100e09] text-[#100e09] font-bold' : 'border-transparent hover:text-gray-900'
          }`}
        >
          All Permitted Records
        </button>
      </div>

      {/* Desktop Filter & Sort Controls */}
      <div className="hidden md:grid grid-cols-12 gap-3 bg-[#f5f4eb] border border-gray-200 p-4 rounded-2xl shadow-2xs">
        {/* Search */}
        <div className="relative col-span-4">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search invoice #, client, project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 pl-9 pr-3 text-xs text-[#1E1E1E] placeholder-gray-400 focus:border-[#100e09] focus:outline-none"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="col-span-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
              <ArrowUpDown className="h-3.5 w-3.5" />
            </span>
            <select
              value={sortOption}
              onChange={(e) => { setSortOption(e.target.value); setCurrentPage(1); }}
              className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 pl-8 pr-3 text-xs font-medium text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
            >
              <option value="latest_created">Sort: Latest Created (Default)</option>
              <option value="oldest_created">Sort: Oldest Created</option>
              <option value="latest_issued">Sort: Latest Issued</option>
              <option value="oldest_issued">Sort: Oldest Issued</option>
              <option value="due_soonest">Sort: Due Date Soonest</option>
              <option value="due_latest">Sort: Due Date Latest</option>
              <option value="highest_amount">Sort: Highest Amount</option>
              <option value="lowest_amount">Sort: Lowest Amount</option>
              <option value="recently_updated">Sort: Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs font-medium text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="sent">Sent</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="rejected">Rejected</option>
            <option value="void">Void</option>
          </select>
        </div>

        {/* Currency Dropdown */}
        <div className="col-span-2">
          <select
            value={currencyFilter}
            onChange={(e) => { setCurrencyFilter(e.target.value); setCurrentPage(1); }}
            className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs font-medium text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
          >
            <option value="all">All Currencies</option>
            <option value="BDT">BDT (৳) — CLTD</option>
            <option value="USD">USD ($) — CLLC</option>
          </select>
        </div>
      </div>

      {/* Main Ledger Table / Cards */}
      {loading ? (
        <div className="flex h-64 items-center justify-center bg-[#f5f4eb] border border-gray-100 rounded-2xl">
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#100e09]" />
            <span className="text-xs text-gray-500 font-semibold">Loading PostgreSQL Ledger...</span>
          </div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-[#f5f4eb] p-12 text-center text-xs text-gray-500 space-y-2">
          <p className="font-semibold text-gray-700">No invoices found matching the selected criteria.</p>
          <p className="text-gray-400">Try adjusting your filters, sort order, or search query.</p>
        </div>
      ) : (
        <>
          {/* ── Desktop Table (md+) ── */}
          <div className="hidden md:block bg-[#f5f4eb] border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 bg-gray-50/80 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Project / Ref</th>
                    <th className="p-4">Issue Date</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => {
                    const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'draft' && inv.status !== 'rejected';
                    const isArchived = Boolean(inv.archived_at);

                    return (
                      <tr key={inv.id} className={`hover:bg-gray-50/60 transition ${isOverdue ? 'bg-rose-50/10' : ''}`}>
                        {/* Invoice Number */}
                        <td className="p-4 font-bold">
                          {inv.invoice_number ? (
                            <Link href={`/billing/invoices/${inv.id}`} className="hover:text-[#100e09] text-gray-900">
                              {inv.invoice_number}
                            </Link>
                          ) : (
                            <span className="text-gray-400 italic flex items-center space-x-1">
                              <span>Draft</span>
                              <span className="text-[9px] uppercase bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 font-bold">Draft</span>
                            </span>
                          )}
                        </td>

                        {/* Client */}
                        <td className="p-4 font-semibold text-gray-800">
                          <Link href={`/billing/clients/${inv.client_id}`} className="hover:underline">
                            {getClientName(inv.client_id)}
                          </Link>
                        </td>

                        {/* Project / Reference */}
                        <td className="p-4 truncate max-w-[160px] text-gray-700">
                          <div className="font-semibold truncate">{inv.project_name}</div>
                          {inv.reference_number && <div className="text-[10px] text-gray-400 font-mono">Ref: {inv.reference_number}</div>}
                        </td>

                        {/* Issue Date */}
                        <td className="p-4 text-gray-500 whitespace-nowrap">{inv.issue_date || '—'}</td>

                        {/* Due Date */}
                        <td className="p-4 whitespace-nowrap">
                          <span className={`flex items-center space-x-1 ${isOverdue ? 'text-rose-700 font-bold' : 'text-gray-500'}`}>
                            <span>{inv.due_date || '—'}</span>
                            {isOverdue && <AlertCircle className="h-3.5 w-3.5 text-rose-600" />}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-wide font-bold ${getStatusBadgeColor(inv.status, isArchived)}`}>
                            {isArchived ? 'Archived' : inv.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="p-4 text-right font-black text-gray-900 whitespace-nowrap">
                          {formatCurrency(inv.total_payable || 0, inv.currency)}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {/* View */}
                            <Link
                              href={`/billing/invoices/${inv.id}`}
                              className="inline-flex items-center space-x-1 text-xs font-semibold text-[#100e09] hover:underline"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </Link>

                            {/* Restore if Archived */}
                            {isArchived ? (
                              <button
                                onClick={(e) => handleRestoreInvoice(inv, e)}
                                disabled={actionLoading === inv.id}
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                                title="Restore Archived Invoice"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Restore</span>
                              </button>
                            ) : inv.status === 'void' ? (
                              <>
                                {/* Archive Void Invoice */}
                                <button
                                  onClick={(e) => openArchiveModal(inv, e)}
                                  disabled={actionLoading === inv.id}
                                  className="inline-flex items-center space-x-1 text-xs font-semibold text-purple-700 hover:underline cursor-pointer"
                                  title="Archive Void Invoice"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  <span>Archive</span>
                                </button>

                                {/* Permanent Delete for Void Invoice (Super Admin Only) */}
                                {isSuperAdmin && (
                                  <button
                                    onClick={(e) => openPermanentDeleteModal(inv, e)}
                                    disabled={actionLoading === inv.id}
                                    className="inline-flex items-center space-x-1 text-xs font-semibold text-rose-700 hover:underline cursor-pointer"
                                    title="Permanently Delete Void Invoice"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </>
                            ) : inv.status === 'draft' || inv.status === 'rejected' ? (
                              <button
                                onClick={(e) => handleDeleteDraft(inv, e)}
                                disabled={actionLoading === inv.id}
                                className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                                title="Delete Draft Invoice"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile Card View (< md) ── */}
          <div className="md:hidden space-y-3">
            {invoices.map((inv) => {
              const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'draft' && inv.status !== 'rejected';
              const isArchived = Boolean(inv.archived_at);

              return (
                <div key={inv.id} className={`bg-[#f5f4eb] border rounded-2xl p-4 shadow-2xs space-y-3 ${isOverdue ? 'border-rose-200 bg-rose-50/10' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/billing/invoices/${inv.id}`} className="font-bold text-sm text-gray-900 hover:text-[#100e09] block truncate">
                        {inv.invoice_number || 'Draft Invoice'}
                      </Link>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{inv.project_name}</p>
                    </div>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] uppercase font-bold shrink-0 ${getStatusBadgeColor(inv.status, isArchived)}`}>
                      {isArchived ? 'Archived' : inv.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Client</p>
                      <p className="font-semibold text-gray-800 truncate">{getClientName(inv.client_id)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Amount</p>
                      <p className="font-extrabold text-gray-900">{formatCurrency(inv.total_payable || 0, inv.currency)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Issued</p>
                      <p className="text-gray-700">{inv.issue_date || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Due</p>
                      <p className={`flex items-center gap-1 ${isOverdue ? 'text-rose-700 font-bold' : 'text-gray-700'}`}>
                        {inv.due_date || '—'}
                        {isOverdue && <AlertCircle className="h-3 w-3" />}
                      </p>
                    </div>
                  </div>

                  {/* Mobile Actions Bar */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/billing/invoices/${inv.id}`}
                      className="flex-1 flex items-center justify-center space-x-1 text-xs font-semibold text-[#100e09] bg-[#100e09]/5 border border-[#100e09]/20 py-2 rounded-xl transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View</span>
                    </Link>

                    {isArchived ? (
                      <button
                        onClick={(e) => handleRestoreInvoice(inv, e)}
                        className="flex-1 flex items-center justify-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 py-2 rounded-xl transition cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Restore</span>
                      </button>
                    ) : inv.status === 'void' ? (
                      <>
                        <button
                          onClick={(e) => openArchiveModal(inv, e)}
                          className="flex-1 flex items-center justify-center space-x-1 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 py-2 rounded-xl transition cursor-pointer"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span>Archive</span>
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={(e) => openPermanentDeleteModal(inv, e)}
                            className="p-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                            title="Permanently Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    ) : inv.status === 'draft' || inv.status === 'rejected' ? (
                      <button
                        onClick={(e) => handleDeleteDraft(inv, e)}
                        className="p-2 text-gray-500 bg-gray-50 border border-gray-200 rounded-xl transition cursor-pointer"
                        title="Delete Draft"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-[#f5f4eb] border border-gray-200 p-4 rounded-2xl shadow-2xs">
              <span className="text-xs text-gray-500 font-medium">
                Page {currentPage} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-gray-200 bg-[#f5f4eb] text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-gray-200 bg-[#f5f4eb] text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Mobile/Tablet Filter Drawer */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div className="bg-[#f5f4eb] w-full max-w-sm h-full p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="font-extrabold text-base text-gray-900">Filters & Sorting</h3>
                <button 
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Search</label>
                <input
                  type="text"
                  placeholder="Search invoice #, client, project..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs"
                />
              </div>

              {/* Sort */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Sort By</label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs"
                >
                  <option value="latest_created">Latest Created (Default)</option>
                  <option value="oldest_created">Oldest Created</option>
                  <option value="latest_issued">Latest Issued</option>
                  <option value="oldest_issued">Oldest Issued</option>
                  <option value="due_soonest">Due Date Soonest</option>
                  <option value="due_latest">Due Date Latest</option>
                  <option value="highest_amount">Highest Amount</option>
                  <option value="lowest_amount">Lowest Amount</option>
                  <option value="recently_updated">Recently Updated</option>
                </select>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="sent">Sent</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="rejected">Rejected</option>
                  <option value="void">Void</option>
                </select>
              </div>

              {/* Currency */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Currency</label>
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs"
                >
                  <option value="all">All Currencies</option>
                  <option value="BDT">BDT (৳) — CLTD</option>
                  <option value="USD">USD ($) — CLLC</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => { setCurrentPage(1); setIsFilterDrawerOpen(false); }}
              className="w-full bg-[#100e09] text-[#f5f4eb] py-3 rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {archiveModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#f5f4eb] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center space-x-3 text-purple-700">
              <Archive className="h-6 w-6" />
              <h3 className="text-lg font-bold text-gray-900">Archive Invoice</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Archiving <strong className="text-gray-900">{archiveModalInvoice.invoice_number || archiveModalInvoice.project_name}</strong> will hide it from active ledger views while retaining all audit trails, payment histories, and serial sequence records.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Archive Reason (Optional)</label>
              <textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Specify cleanup or administrative reason..."
                rows={3}
                className="w-full rounded-xl border border-gray-200 p-3 text-xs focus:border-purple-600 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setArchiveModalInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArchive}
                className="px-5 py-2 text-xs font-bold text-[#f5f4eb] bg-purple-700 hover:bg-purple-800 rounded-xl shadow-md cursor-pointer"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Modal (Super Admin Only) */}
      {deleteModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#f5f4eb] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 border border-rose-100 my-8">
            <div className="flex items-center space-x-3 text-rose-700">
              <ShieldAlert className="h-7 w-7 shrink-0" />
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Permanently Delete Void Invoice</h3>
                <p className="text-[11px] text-rose-600 font-semibold">Super Admin Destructive Action</p>
              </div>
            </div>

            {/* Dependency Verification Status Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2 text-xs">
              <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider block">Target Invoice Details</span>
              <div className="grid grid-cols-2 gap-2 text-gray-700">
                <p><span className="text-gray-400">Invoice #:</span> <strong className="text-gray-900 font-mono">{deleteModalInvoice.invoice_number || 'DRAFT'}</strong></p>
                <p><span className="text-gray-400">Client:</span> <strong className="text-gray-900">{getClientName(deleteModalInvoice.client_id)}</strong></p>
                <p><span className="text-gray-400">Total Amount:</span> <strong className="text-gray-900">{formatCurrency(deleteModalInvoice.total_payable || 0, deleteModalInvoice.currency)}</strong></p>
                <p><span className="text-gray-400">Status:</span> <strong className="text-slate-700 uppercase">{deleteModalInvoice.status}</strong></p>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Financial Dependency Check</span>
                {eligibilityChecking ? (
                  <div className="flex items-center space-x-2 text-gray-500 py-1">
                    <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                    <span>Verifying server-side dependencies...</span>
                  </div>
                ) : eligibilityResult?.eligible ? (
                  <div className="flex items-center space-x-2 text-emerald-700 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Eligible for permanent deletion (No financial dependencies found)</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
                    <p className="font-bold flex items-center space-x-1.5">
                      <ShieldAlert className="h-4 w-4 text-rose-600" />
                      <span>Cannot Be Permanently Deleted</span>
                    </p>
                    <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-800">
                      {eligibilityResult?.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-gray-600 pt-1">
                      This void invoice must be archived instead to protect audit integrity.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {eligibilityResult?.eligible && (
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-800 block">
                    Type <code className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono select-all">DELETE {deleteModalInvoice.invoice_number || 'DRAFT'}</code> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={`DELETE ${deleteModalInvoice.invoice_number || 'DRAFT'}`}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-mono focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-800 block">Deletion Reason (Required)</label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Provide mandatory compliance audit reason for permanent deletion..."
                    rows={2}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-rose-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setDeleteModalInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              {eligibilityResult?.eligible && (
                <button
                  onClick={handleConfirmPermanentDelete}
                  disabled={
                    deleteConfirmText.trim() !== `DELETE ${deleteModalInvoice.invoice_number || 'DRAFT'}` ||
                    !deleteReason.trim() ||
                    actionLoading === deleteModalInvoice.id
                  }
                  className="px-5 py-2.5 text-xs font-bold text-[#f5f4eb] bg-rose-700 hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md transition cursor-pointer flex items-center space-x-2"
                >
                  {actionLoading === deleteModalInvoice.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Permanently Delete Invoice</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
