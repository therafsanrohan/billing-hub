'use client';

import { useState, useEffect } from 'react';
import { db, BillingClient, Invoice, Payment, localStore } from '@/lib/db';
import { formatCurrency } from '@/lib/calculations';
import Link from 'next/link';
import { Plus, Search, Archive, UserCheck, Mail, Phone, MapPin, Filter, RotateCcw } from 'lucide-react';

export default function ClientListPage() {
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const list = await db.getClients();
        const invs = await db.getInvoices();
        const pays = await db.getPayments();
        setClients(list);
        setInvoices(invs);
        setPayments(pays);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleArchive = async (id: string, currentStatus: 'active' | 'archived') => {
    const nextStatus = currentStatus === 'active' ? 'archived' : 'active';
    const message = nextStatus === 'archived' ? 'Archive this client?' : 'Restore this client?';
    if (!confirm(message)) return;

    try {
      const updated = await db.updateClient(id, { status: nextStatus });
      setClients(clients.map(c => c.id === id ? updated : c));
    } catch (err) {
      alert('Error updating client status');
    }
  };

  const getClientBalances = (clientId: string) => {
    let bdtDue = 0;
    let usdDue = 0;

    const clientInvoices = invoices.filter(i => i.client_id === clientId && i.status !== 'draft' && i.status !== 'void');
    clientInvoices.forEach(inv => {
      const amountDue = inv.amount_due !== undefined ? inv.amount_due : (inv.total_payable || 0);

      if (inv.currency === 'BDT') {
        bdtDue += amountDue;
      } else {
        usdDue += amountDue;
      }
    });

    return { bdtDue, usdDue };
  };

  const getClientProjectStatus = (clientId: string) => {
    const activeInvoices = invoices.filter(i => 
      i.client_id === clientId && 
      (i.status === 'sent' || i.status === 'partially_paid' || i.status === 'overdue' || i.status === 'approved' || i.status === 'pending_approval')
    );
    if (activeInvoices.length > 0) {
      return { isOnline: true, label: `Active Project (${activeInvoices.length} Open)`, badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' };
    }
    return { isOnline: false, label: 'Work Completed (Offline)', badgeBg: 'bg-gray-50 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
  };

  const countries = Array.from(new Set(clients.map(c => c.country).filter(Boolean)));

  const filteredClients = clients.filter(c => {
    const matchesSearch =
      !search.trim() ||
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      c.billing_email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()) ||
      c.country?.toLowerCase().includes(search.toLowerCase()) ||
      c.tax_number?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = clientTypeFilter === 'all' || c.client_type === clientTypeFilter;
    const matchesCurrency = currencyFilter === 'all' || c.preferred_currency === currencyFilter;
    const matchesCountry = countryFilter === 'all' || c.country === countryFilter;

    const projStatus = getClientProjectStatus(c.id);
    const matchesProjectStatus =
      projectStatusFilter === 'all' ||
      (projectStatusFilter === 'active_project' && projStatus.isOnline) ||
      (projectStatusFilter === 'completed' && !projStatus.isOnline);

    return matchesSearch && matchesStatus && matchesType && matchesCurrency && matchesCountry && matchesProjectStatus;
  });

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('active');
    setClientTypeFilter('all');
    setCurrencyFilter('all');
    setProjectStatusFilter('all');
    setCountryFilter('all');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Billing Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            Directory of corporate and individual client profiles with dynamic project status
          </p>
        </div>
        <Link
          href="/billing/clients/new"
          className="flex items-center space-x-2 rounded-xl bg-[#100e09] px-4 py-2.5 text-sm font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Client Profile</span>
        </Link>
      </div>

      {/* Search and Advanced Filters */}
      <div className="bg-[#f5f4eb] border border-gray-200 p-4 rounded-2xl space-y-3 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients by company name, contact person, email, phone, city..."
              className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 pl-10 pr-4 text-xs text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs font-semibold text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
            >
              <option value="active">Active Clients Only</option>
              <option value="archived">Archived Clients Only</option>
              <option value="all">All Statuses</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={clientTypeFilter}
              onChange={(e) => setClientTypeFilter(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs font-semibold text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
            >
              <option value="all">All Client Types</option>
              <option value="company">Corporate / Company</option>
              <option value="individual">Individual</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-gray-100">
          <div className="md:col-span-4">
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
            >
              <option value="all">All Billing Currencies</option>
              <option value="BDT">BDT (৳) Billing</option>
              <option value="USD">USD ($) Billing</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              value={projectStatusFilter}
              onChange={(e) => setProjectStatusFilter(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
            >
              <option value="all">All Project Statuses</option>
              <option value="active_project">Active Project (Open Invoices)</option>
              <option value="completed">Work Completed (Offline)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
            >
              <option value="all">All Countries</option>
              {countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 flex items-center justify-end">
            <button
              onClick={resetFilters}
              className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-500 hover:text-[#100e09] transition cursor-pointer"
              title="Reset Filters"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid List */}
      {filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-450 space-y-2">
          <p className="font-semibold text-gray-700">No clients found matching the selected criteria.</p>
          <button onClick={resetFilters} className="text-xs text-[#100e09] underline font-bold cursor-pointer">Reset Filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClients.map((client) => {
            const { bdtDue, usdDue } = getClientBalances(client.id);
            const projStatus = getClientProjectStatus(client.id);

            return (
              <div
                key={client.id}
                className={`rounded-2xl border bg-[#f5f4eb] p-6 shadow-xs flex flex-col justify-between transition hover:shadow-md ${
                  client.status === 'archived'
                    ? 'border-gray-200 border-dashed bg-gray-50/50'
                    : 'border-gray-100'
                }`}
              >
                <div>
                  {/* Client title */}
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold text-gray-500">
                          {client.client_type}
                        </span>
                        <span className={`inline-flex items-center space-x-1.5 border rounded-full px-2 py-0.5 text-[9px] font-bold ${projStatus.badgeBg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${projStatus.dot}`} />
                          <span>{projStatus.label}</span>
                        </span>
                      </div>
                      <h2 className="font-bold text-md leading-tight text-[#1E1E1E] truncate">
                        {client.company_name || client.contact_person}
                      </h2>
                      {client.company_name && (
                        <p className="text-xs text-gray-400 font-semibold truncate mt-0.5">{client.contact_person}</p>
                      )}
                    </div>
                    {client.status === 'archived' && (
                      <span className="text-[10px] uppercase font-bold text-gray-450 border border-gray-200 rounded px-1.5 py-0.5 bg-[#f5f4eb] shrink-0">
                        Archived
                      </span>
                    )}
                  </div>

                  {/* Core details */}
                  <div className="space-y-2 text-xs text-gray-500 mb-6">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{client.billing_email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{client.city}, {client.country}</span>
                    </div>
                  </div>
                </div>

                {/* Balance Split Ledger */}
                <div className="border-t border-gray-100 pt-4 space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Outstanding BDT:</span>
                    <span className={`font-bold ${bdtDue > 0 ? 'text-[#100e09]' : 'text-gray-600'}`}>
                      {formatCurrency(bdtDue, 'BDT')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Outstanding USD:</span>
                    <span className={`font-bold ${usdDue > 0 ? 'text-[#100e09]' : 'text-gray-600'}`}>
                      {formatCurrency(usdDue, 'USD')}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                    <Link
                      href={`/billing/clients/${client.id}`}
                      className="flex-1 text-center bg-gray-50 hover:bg-gray-100 text-gray-800 text-xs font-semibold py-2 px-3 rounded-lg transition cursor-pointer"
                    >
                      View Profile
                    </Link>
                    
                    <button
                      onClick={() => handleArchive(client.id, client.status)}
                      className="rounded-lg border border-gray-200 hover:border-red-400 hover:bg-red-50 p-2 text-gray-450 hover:text-red-600 transition cursor-pointer"
                      title={client.status === 'active' ? 'Archive Client' : 'Restore Client'}
                    >
                      {client.status === 'active' ? <Archive className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
