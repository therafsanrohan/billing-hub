'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, BillingClient, Profile, BusinessEntity, InvoiceItem, Invoice, ClientServiceRate, localStore } from '@/lib/db';
import { calculateTotals, formatCurrency, fetchLiveMarketUsdRate } from '@/lib/calculations';
import { ArrowLeft, Plus, Trash2, Copy, Percent, DollarSign, FileText, CheckCircle2, Sparkles, Megaphone, X, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { nullifyEmptyUUID } from '@/lib/utils/uuid';
import { handleDatabaseError } from '@/lib/utils/db-error-handler';

interface FormItem {
  service_name: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  is_paid_media?: boolean;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedClientId = searchParams.get('clientId');

  // Database lists
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Form states
  const [selectedClientId, setSelectedClientId] = useState('');
  const [currency, setCurrency] = useState<'BDT' | 'USD'>('USD');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [dueDate, setDueDate] = useState('');

  // ... rest of component stays intact ...

  const [projectName, setProjectName] = useState('');
  const [servicePeriod, setServicePeriod] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [accountManagerId, setAccountManagerId] = useState('');
  
  // Discount states
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percentage'>('none');
  const [discountValue, setDiscountValue] = useState(0);
  
  // VAT states (Default to Exclusive per user request)
  const [vatRate, setVatRate] = useState(15);
  const [vatInclusive, setVatInclusive] = useState(false);
  const [roundTotal, setRoundTotal] = useState(false);

  // Notes
  const [clientNote, setClientNote] = useState('Thank you for your business.');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [termsConditions, setTermsConditions] = useState('Standard payment terms apply. Interest of 1.5% per month will be charged on late invoices.');
  const [internalNote, setInternalNote] = useState('');

  // Paid Media & Live Exchange Rate states
  const [usdExchangeRate, setUsdExchangeRate] = useState<number>(125.50);
  const [clientRates, setClientRates] = useState<ClientServiceRate[]>([]);
  
  // Paid Media Modal Drawer states
  const [showPaidMediaModal, setShowPaidMediaModal] = useState(false);
  const [mediaPlatform, setMediaPlatform] = useState('Meta Ads (FB/Instagram)');
  const [mediaUsdBudget, setMediaUsdBudget] = useState(1000);
  const [mediaUsdRate, setMediaUsdRate] = useState(125.50);
  const [mediaFeePercent, setMediaFeePercent] = useState(10);
  const [mediaVatPercent, setMediaVatPercent] = useState(15);

  // Items list
  const [items, setItems] = useState<FormItem[]>([
    { service_name: '', description: '', quantity: 1, unit: 'Project', rate: 0 }
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-calculated entities
  const activeEntity = entities.find(e => e.entity_code === (currency === 'BDT' ? 'CLTD' : 'CLLC'));
  const activeClient = clients.find(c => c.id === selectedClientId);

  useEffect(() => {
    async function loadData() {
      try {
        const u = await db.getCurrentUser();
        setCurrentUser(u);

        const cls = await db.getClients();
        setClients(cls.filter(c => c.status === 'active'));
        
        const ents = await db.getEntities();
        setEntities(ents);
        
        const profs = await db.getProfiles();
        setManagers(profs);

        // Fetch live market USD exchange rate
        const liveUsdRate = await fetchLiveMarketUsdRate();
        setUsdExchangeRate(liveUsdRate);
        setMediaUsdRate(liveUsdRate);

        if (preSelectedClientId) {
          setSelectedClientId(preSelectedClientId);
          const activeC = cls.find(c => c.id === preSelectedClientId);
          if (activeC) {
            setCurrency(activeC.preferred_currency);
            setPaymentTerms(activeC.default_payment_terms);
            setAccountManagerId(activeC.account_manager_id || '');
          }
        } else if (cls.length > 0) {
          setSelectedClientId(cls[0].id);
          setCurrency(cls[0].preferred_currency);
          setPaymentTerms(cls[0].default_payment_terms);
          setAccountManagerId(cls[0].account_manager_id || '');
        }

        if (u) {
          setAccountManagerId(u.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [preSelectedClientId]);

  // Sync entity payment instructions defaults
  useEffect(() => {
    if (activeEntity) {
      setPaymentInstructions(activeEntity.payment_instructions);
    }
  }, [activeEntity]);

  // Sync client default terms & manager + load Client Service Rates memory
  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setCurrency(client.preferred_currency);
      setPaymentTerms(client.default_payment_terms);
      setAccountManagerId(client.account_manager_id || '');
    }
    if (clientId) {
      const rates = await db.getClientServiceRates(clientId);
      setClientRates(rates);
    } else {
      setClientRates([]);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      db.getClientServiceRates(selectedClientId).then(setClientRates);
    }
  }, [selectedClientId]);

  // Apply enlisted client service rate preset
  const applyClientRatePreset = (preset: ClientServiceRate) => {
    const lastItem = items[items.length - 1];
    if (items.length === 1 && !lastItem.service_name && lastItem.rate === 0) {
      setItems([{
        service_name: preset.service_name,
        description: preset.is_paid_media ? `Paid media buying budget converted @ ৳${preset.usd_rate || usdExchangeRate}/USD` : `Agreed pricing rate for ${activeClient?.company_name || 'Client'}`,
        quantity: 1,
        unit: preset.unit || 'pcs',
        rate: preset.unit_price,
        is_paid_media: preset.is_paid_media
      }]);
    } else {
      setItems([...items, {
        service_name: preset.service_name,
        description: preset.is_paid_media ? `Paid media buying budget converted @ ৳${preset.usd_rate || usdExchangeRate}/USD` : `Agreed pricing rate for ${activeClient?.company_name || 'Client'}`,
        quantity: 1,
        unit: preset.unit || 'pcs',
        rate: preset.unit_price,
        is_paid_media: preset.is_paid_media
      }]);
    }
  };

  // Insert Paid Media Buying Segment Line Items
  const handleInsertPaidMedia = () => {
    const budgetBdt = parseFloat((mediaUsdBudget * mediaUsdRate).toFixed(2));
    const feeBdt = mediaFeePercent > 0 ? parseFloat(((budgetBdt * mediaFeePercent) / 100).toFixed(2)) : 0;
    const vatBdt = mediaVatPercent > 0 ? parseFloat(((budgetBdt * mediaVatPercent) / 100).toFixed(2)) : 0;

    const mediaItem: FormItem = {
      service_name: `${mediaPlatform} Media Buying ($${mediaUsdBudget.toLocaleString()} @ ৳${mediaUsdRate}/USD)`,
      description: `Ad Media Spend Budget: $${mediaUsdBudget.toLocaleString()} USD converted at live market rate ৳${mediaUsdRate} BDT/USD`,
      quantity: 1,
      unit: 'Budget',
      rate: currency === 'USD' ? mediaUsdBudget : budgetBdt,
      is_paid_media: true
    };

    const newItemsList = [...items];
    if (newItemsList.length === 1 && !newItemsList[0].service_name && newItemsList[0].rate === 0) {
      newItemsList[0] = mediaItem;
    } else {
      newItemsList.push(mediaItem);
    }

    if (feeBdt > 0) {
      newItemsList.push({
        service_name: `${mediaPlatform} Management Fee (${mediaFeePercent}%)`,
        description: `Digital agency media management, strategy, and ad campaign optimization fee`,
        quantity: 1,
        unit: 'Fee',
        rate: currency === 'USD' ? parseFloat(((mediaUsdBudget * mediaFeePercent) / 100).toFixed(2)) : feeBdt
      });
    }

    if (vatBdt > 0) {
      newItemsList.push({
        service_name: `${mediaPlatform} Platform VAT / Govt Tax (${mediaVatPercent}%)`,
        description: `Government & ad platform mandatory VAT / Tax on digital media spend`,
        quantity: 1,
        unit: 'Tax',
        rate: currency === 'USD' ? parseFloat(((mediaUsdBudget * mediaVatPercent) / 100).toFixed(2)) : vatBdt
      });
    }

    setItems(newItemsList);
    setShowPaidMediaModal(false);
  };

  // Sync due date calculation
  useEffect(() => {
    if (!issueDate) return;
    const date = new Date(issueDate);
    if (paymentTerms === 'Due on Receipt') {
      setDueDate(issueDate);
    } else if (paymentTerms === '7 Days') {
      date.setDate(date.getDate() + 7);
      setDueDate(date.toISOString().split('T')[0]);
    } else if (paymentTerms === '15 Days') {
      date.setDate(date.getDate() + 15);
      setDueDate(date.toISOString().split('T')[0]);
    } else if (paymentTerms === '30 Days') {
      date.setDate(date.getDate() + 30);
      setDueDate(date.toISOString().split('T')[0]);
    }
  }, [issueDate, paymentTerms]);

  // Items manipulation
  const handleItemChange = (index: number, field: keyof FormItem, val: any) => {
    const next = [...items];
    if (field === 'quantity' || field === 'rate') {
      next[index] = { ...next[index], [field]: parseFloat(val) || 0 };
    } else {
      next[index] = { ...next[index], [field]: val };
    }
    setItems(next);
  };

  const addItem = () => {
    setItems([...items, { service_name: '', description: '', quantity: 1, unit: 'Project', rate: 0 }]);
  };

  const duplicateItem = (index: number) => {
    const target = items[index];
    setItems([...items, { ...target }]);
  };

  const deleteItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Totals calculations
  const totals = calculateTotals({
    items: items.map(i => ({ quantity: i.quantity, rate: i.rate, is_paid_media: i.is_paid_media, service_name: i.service_name })),
    discountType,
    discountValue,
    vatRate: currency === 'BDT' ? vatRate : 0,
    vatInclusive,
    roundTotal
  });

  const handleSave = async (status: 'draft' | 'pending_approval') => {
    if (!selectedClientId) {
      setError('Please select a client.');
      return;
    }
    if (!activeEntity?.id) {
      setError('The required billing entity is not configured in Supabase. Please ask an administrator to configure Corevow Limited (BDT) or Corevow LLC (USD).');
      return;
    }
    if (!projectName.trim()) {
      setError('Please enter a project name.');
      return;
    }
    if (items.some(i => !i.service_name.trim())) {
      setError('Please enter a service name for all line items.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const inv = await db.createInvoice({
        client_id: selectedClientId,
        currency,
        entity_id: activeEntity.id,
        issue_date: issueDate,
        payment_terms: paymentTerms,
        due_date: dueDate,
        project_name: projectName.trim(),
        service_period: servicePeriod.trim(),
        po_number: poNumber.trim(),
        reference_number: referenceNumber.trim(),
        account_manager_id: nullifyEmptyUUID(accountManagerId),
        discount_type: discountType,
        discount_value: discountValue,
        vat_rate: currency === 'BDT' ? vatRate : 0,
        vat_inclusive: vatInclusive,
        client_note: clientNote.trim(),
        payment_instructions: paymentInstructions.trim(),
        terms_conditions: termsConditions.trim(),
        internal_note: internalNote.trim(),
        created_by: currentUser?.id || '00000000-0000-0000-0000-000000000001'
      }, items.map(i => ({
        service_name: i.service_name.trim(),
        description: i.description.trim(),
        quantity: i.quantity,
        unit: i.unit,
        rate: i.rate,
        amount: parseFloat((i.quantity * i.rate).toFixed(2)),
        sort_order: 0
      })));

      if (status === 'pending_approval') {
        await db.submitForApproval(inv.id);
      }

      router.push(`/billing/invoices/${inv.id}`);
    } catch (err: any) {
      const handled = handleDatabaseError(err, 'createInvoice');
      setError(handled.userMessage);
      setSaving(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  const isViewer = false;
  if (isViewer) {
    return (
      <div className="text-center p-8 bg-red-50 text-[#100e09] rounded-2xl">
        You do not have permission to create invoices.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Back button */}
      <div>
        <Link href="/billing/invoices" className="inline-flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Invoices Ledger</span>
        </Link>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Create Invoice Draft</h1>
          <p className="text-sm text-gray-500 mt-1">Configure client details, currency, legal entity, and invoice lines</p>
        </div>
      </div>

      {/* Main Split View: Form left, scaled A4 live preview right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Invoice Form (Left side) */}
        <div className="xl:col-span-7 bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 space-y-6">
          
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-[#100e09]">
              {error}
            </div>
          )}

          {/* Section 1: Client Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">1. Client Particulars</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="client_select" className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-1">
                  Select Corporate Client
                </label>
                <select
                  id="client_select"
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.contact_person} ({c.preferred_currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end pb-0.5">
                <Link
                  href="/billing/clients/new"
                  target="_blank"
                  className="text-xs font-semibold text-[#100e09] hover:underline"
                >
                  + Add Client (New Window)
                </Link>
              </div>
            </div>
          </div>

          {/* Section 2: Currency & Business Entity Mapping */}
          <div className="space-y-4 pt-6 border-t border-gray-50">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">2. Billing Currency & Dollar Rate</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-2">Select Invoice Currency</span>
                <div className="flex items-center space-x-6 pt-1">
                  <label className="flex items-center space-x-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="currency"
                      checked={currency === 'USD'}
                      onChange={() => setCurrency('USD')}
                      className="accent-[#100e09] h-4.5 w-4.5"
                    />
                    <span>USD ($)</span>
                  </label>
                  
                  <label className="flex items-center space-x-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="currency"
                      checked={currency === 'BDT'}
                      onChange={() => setCurrency('BDT')}
                      className="accent-[#100e09] h-4.5 w-4.5"
                    />
                    <span>BDT (৳)</span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="usd_exchange_rate" className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-1">
                  Manual USD Exchange Rate
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-gray-400">৳</span>
                  <input
                    id="usd_exchange_rate"
                    type="number"
                    step="any"
                    value={usdExchangeRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setUsdExchangeRate(val);
                      setMediaUsdRate(val);
                    }}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 pl-7 pr-3 text-sm font-bold text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                    placeholder="125.50"
                  />
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 block">Market USD/BDT rate for media buying</span>
              </div>

              {/* Locked mapped entity summary */}
              <div className="rounded-xl bg-gray-50 p-3.5 text-xs border border-gray-100">
                <span className="text-gray-400 font-semibold uppercase block">Locked Mapped Entity</span>
                <p className="font-extrabold text-xs text-gray-800 mt-0.5 truncate">
                  {activeEntity ? activeEntity.legal_name : (currency === 'BDT' ? 'Corevow Limited' : 'Corevow LLC')}
                </p>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5 truncate">
                  {activeEntity ? `${activeEntity.invoice_prefix} prefix` : (currency === 'BDT' ? 'CLTD-BDT prefix' : 'CLLC-USD prefix')}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Details */}
          <div className="space-y-4 pt-6 border-t border-gray-50">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">3. Details & Metadata</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label htmlFor="issue_date" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                  Issue Date
                </label>
                <input
                  id="issue_date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="payment_terms" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                  Payment Terms
                </label>
                <select
                  id="payment_terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
                >
                  <option value="Due on Receipt">Due on Receipt</option>
                  <option value="7 Days">7 Days</option>
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label htmlFor="due_date" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                  Due Date
                </label>
                {paymentTerms === 'Custom' ? (
                  <input
                    id="due_date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                  />
                ) : (
                  <input
                    id="due_date_readonly"
                    type="date"
                    readOnly
                    value={dueDate}
                    className="block w-full rounded-lg border border-gray-100 bg-gray-50 py-2 px-3 text-sm text-gray-500 focus:outline-none"
                  />
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="project_name" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                  Project Title / Name <span className="text-[#100e09]">*</span>
                </label>
                <input
                  id="project_name"
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                  placeholder="e.g. app iOS App Refactor"
                />
              </div>

              <div>
                <label htmlFor="service_period" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                  Billing Service Period
                </label>
                <input
                  id="service_period"
                  type="text"
                  value={servicePeriod}
                  onChange={(e) => setServicePeriod(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                  placeholder="e.g. July 1 - July 31, 2026"
                />
              </div>

              <div>
                <label htmlFor="po_number" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                  Purchase Order (PO) #
                </label>
                <input
                  id="po_number"
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                  placeholder="e.g. PO-450098"
                />
              </div>

              <div>
                <label htmlFor="ref_number" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                  Internal Reference #
                </label>
                <input
                  id="ref_number"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                  placeholder="e.g. STR-77"
                />
              </div>

              <div>
                <label htmlFor="manager" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                  Account Manager
                </label>
                <select
                  id="manager"
                  value={accountManagerId}
                  onChange={(e) => setAccountManagerId(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Line Items Table */}
          <div className="space-y-4 pt-6 border-t border-gray-50">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">4. Service Line Items</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaidMediaModal(true)}
                  className="flex items-center space-x-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                >
                  <Megaphone className="h-3.5 w-3.5 text-amber-600" />
                  <span>Add Paid Media Buying ($)</span>
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center space-x-1 text-xs font-semibold text-[#100e09] border border-[#100e09] rounded-lg px-3 py-1.5 hover:bg-[#100e09]/5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* Enlisted Client Pricing Memory Presets */}
            {clientRates.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    <span>Enlisted Pricing Memory for {activeClient?.company_name || activeClient?.contact_person || 'Client'}</span>
                  </span>
                  <span className="text-[10px] text-amber-700 font-medium">Click pill to auto-fill agreed rate</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {clientRates.map(rate => (
                    <button
                      key={rate.id}
                      type="button"
                      onClick={() => applyClientRatePreset(rate)}
                      className="rounded-lg bg-[#f5f4eb] border border-amber-300/80 px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-amber-100/80 transition cursor-pointer shadow-2xs flex items-center space-x-1.5"
                    >
                      <span>{rate.service_name}</span>
                      <span className="text-[#100e09] font-bold">({formatCurrency(rate.unit_price, currency)})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span>Line #{idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => duplicateItem(idx)}
                        className="p-1 hover:text-gray-700"
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(idx)}
                        className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                        disabled={items.length === 1}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                    <div className="md:col-span-5">
                      <label className="block font-semibold text-gray-500 mb-0.5">Service Name</label>
                      <input
                        type="text"
                        required
                        value={item.service_name}
                        onChange={(e) => handleItemChange(idx, 'service_name', e.target.value)}
                        placeholder="e.g. Interface UI Design"
                        className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-2.5 text-xs text-[#1E1E1E] focus:outline-none"
                      />
                    </div>
                    
                    <div className="md:col-span-7">
                      <label className="block font-semibold text-gray-500 mb-0.5">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        placeholder="Additional details rendered on final document"
                        className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-2.5 text-xs text-[#1E1E1E] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block font-semibold text-gray-500 mb-0.5">Quantity</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.quantity}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        onChange={(e) => handleItemChange(idx, 'quantity', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-2.5 text-xs text-[#1E1E1E] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block font-semibold text-gray-500 mb-0.5">Unit</label>
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-2.5 text-xs text-[#1E1E1E] focus:outline-none cursor-pointer"
                      >
                        {['Project', 'Month', 'Item', 'Design', 'Video', 'Hour', 'Day', 'Campaign', 'Milestone', 'Package'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block font-semibold text-gray-500 mb-0.5">Rate / Unit Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        onChange={(e) => handleItemChange(idx, 'rate', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 px-2.5 text-xs text-[#1E1E1E] focus:outline-none font-semibold"
                      />
                    </div>

                    <div className="md:col-span-3 flex flex-col justify-end">
                      <label className="block font-semibold text-gray-400 mb-0.5 text-right">Line Total</label>
                      <div className="text-right text-xs font-bold py-1.5 pr-1">
                        {formatCurrency(item.quantity * item.rate, currency)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Discount & VAT Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-gray-50">
            {/* Discount Form */}
            <div className="space-y-3">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Discount Adjustment</span>
              <div className="flex gap-2">
                <select
                  value={discountType}
                  onChange={(e) => {
                    setDiscountType(e.target.value as any);
                    setDiscountValue(0);
                  }}
                  className="rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-2.5 text-xs text-[#1E1E1E] focus:outline-none cursor-pointer"
                >
                  <option value="none">No Discount</option>
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>

                {discountType !== 'none' && (
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="block w-24 rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-2.5 text-xs text-[#1E1E1E] focus:outline-none"
                    placeholder="Value"
                  />
                )}
              </div>
            </div>

            {/* VAT config (Only for BDT invoices) */}
            {currency === 'BDT' ? (
              <div className="space-y-3">
                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">VAT (Value Added Tax) Mode</span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Option 1: VAT Exclusive */}
                  <button
                    type="button"
                    onClick={() => {
                      if (vatRate === 0) setVatRate(15);
                      setVatInclusive(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      vatRate > 0 && !vatInclusive
                        ? 'border-[#100e09] bg-red-50/50 text-[#100e09] font-bold shadow-xs'
                        : 'border-gray-200 bg-[#f5f4eb] text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">VAT Exclusive</span>
                      {vatRate > 0 && !vatInclusive && <span className="text-[9px] bg-[#100e09] text-[#f5f4eb] px-1.5 py-0.2 rounded font-extrabold">ACTIVE</span>}
                    </div>
                    <span className="text-[10px] text-gray-500 font-normal block mt-1">Add on top (+{vatRate > 0 ? vatRate : 15}%)</span>
                  </button>

                  {/* Option 2: VAT Inclusive */}
                  <button
                    type="button"
                    onClick={() => {
                      if (vatRate === 0) setVatRate(15);
                      setVatInclusive(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      vatRate > 0 && vatInclusive
                        ? 'border-[#100e09] bg-red-50/50 text-[#100e09] font-bold shadow-xs'
                        : 'border-gray-200 bg-[#f5f4eb] text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">VAT Inclusive</span>
                      {vatRate > 0 && vatInclusive && <span className="text-[9px] bg-[#100e09] text-[#f5f4eb] px-1.5 py-0.2 rounded font-extrabold">ACTIVE</span>}
                    </div>
                    <span className="text-[10px] text-gray-500 font-normal block mt-1">Included in item rates</span>
                  </button>

                  {/* Option 3: VAT Not Applied */}
                  <button
                    type="button"
                    onClick={() => {
                      setVatRate(0);
                      setVatInclusive(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      vatRate === 0
                        ? 'border-emerald-600 bg-emerald-50/60 text-emerald-800 font-bold shadow-xs'
                        : 'border-gray-200 bg-[#f5f4eb] text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">VAT Not Applied</span>
                      {vatRate === 0 && <span className="text-[9px] bg-emerald-600 text-[#f5f4eb] px-1.5 py-0.2 rounded font-extrabold">EXEMPT</span>}
                    </div>
                    <span className="text-[10px] text-gray-500 font-normal block mt-1">0% / Exempt / Zero-Rated</span>
                  </button>
                </div>

                {/* VAT Rate Input or Exempt Badge */}
                {vatRate > 0 ? (
                  <div className="flex items-center justify-between bg-gray-50/80 p-3 rounded-xl border border-gray-150 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-700">VAT Rate:</span>
                      <input
                        id="vat_rate"
                        type="number"
                        min="0"
                        max="100"
                        value={vatRate}
                        onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                        className="w-16 rounded-lg border border-gray-200 bg-[#f5f4eb] py-1 px-2 font-bold text-gray-900 text-center"
                      />
                      <span className="font-bold text-gray-600">%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 text-[10px]">Calculated VAT: </span>
                      <span className="font-extrabold text-[#100e09]">{formatCurrency(totals.vatAmount, 'BDT')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/60 text-xs text-emerald-900 flex items-center justify-between">
                    <span>VAT Status: <strong className="font-extrabold">VAT Not Applied (0% Exempt)</strong></span>
                    <span className="text-emerald-700 font-bold">৳0.00 VAT</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-450 italic flex items-center">
                VAT breakdown is skipped for USD invoices from Corevow LLC.
              </div>
            )}
          </div>

          {/* Option: Round Total Amount (Remove Decimals) */}
          <div className="flex items-center space-x-2 pt-3 border-t border-gray-50">
            <input
              id="round_total_checkbox"
              type="checkbox"
              checked={roundTotal}
              onChange={(e) => setRoundTotal(e.target.checked)}
              className="accent-[#100e09] h-4 w-4 rounded border-gray-300 cursor-pointer"
            />
            <label htmlFor="round_total_checkbox" className="text-xs font-bold text-gray-700 cursor-pointer">
              Round Total to Whole Number (Remove decimals — e.g. ৳12,450.75 → ৳12,451)
            </label>
          </div>

          {/* Section 6: Notes & Payment Terms */}
          <div className="space-y-4 pt-6 border-t border-gray-50">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">5. Terms & Payment Notes</h3>
            
            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="client_notes" className="block font-semibold text-gray-550 mb-1">
                  Client Notes (Rendered on PDF)
                </label>
                <textarea
                  id="client_notes"
                  rows={2}
                  value={clientNote}
                  onChange={(e) => setClientNote(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-2.5 text-xs text-[#1E1E1E] focus:outline-none resize-y"
                />
              </div>

              <div>
                <label htmlFor="pay_instructions" className="block font-semibold text-gray-555 mb-1">
                  Payment Instructions (Rendered on PDF)
                </label>
                <textarea
                  id="pay_instructions"
                  rows={3}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-2.5 text-xs text-[#1E1E1E] focus:outline-none resize-y font-mono text-[10px]"
                />
              </div>

              <div>
                <label htmlFor="terms_and_conditions" className="block font-semibold text-gray-555 mb-1">
                  Terms & Conditions (Rendered on PDF)
                </label>
                <textarea
                  id="terms_and_conditions"
                  rows={2}
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-2.5 text-xs text-[#1E1E1E] focus:outline-none resize-y"
                />
              </div>

              <div>
                <label htmlFor="internal_notes" className="block font-semibold text-gray-555 mb-1 flex items-center space-x-1.5">
                  <span>Confidential Internal Notes</span>
                  <span className="text-[8px] font-bold text-[#100e09] bg-red-50 px-1 py-0.2 rounded uppercase">Will not print</span>
                </label>
                <textarea
                  id="internal_notes"
                  rows={2}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-2.5 text-xs text-[#1E1E1E] focus:outline-none resize-y"
                  placeholder="Record project notes, approval conditions, etc."
                />
              </div>
            </div>
          </div>

          {/* Action button controls */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-50">
            <Link
              href="/billing/invoices"
              className="rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="rounded-lg border border-gray-250 bg-[#f5f4eb] py-2.5 px-4 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('pending_approval')}
              className="rounded-lg bg-[#100e09] py-2.5 px-6 text-xs font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md transition disabled:opacity-50 cursor-pointer flex items-center space-x-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Submit for Approval</span>
            </button>
          </div>

        </div>

        {/* Scaled Live A4 Invoice Document Preview (Right side) */}
        <div className="xl:col-span-5 space-y-4 sticky top-6 hidden xl:block no-print">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Live Scale A4 Preview</span>
            <span className="text-[10px] text-gray-400 font-semibold bg-gray-100 px-2 py-0.5 rounded">
              A4 Aspect Ratio (Portrait)
            </span>
          </div>

          <div className="border border-gray-150 rounded-2xl shadow-lg bg-[#f5f4eb] overflow-hidden p-6 text-[10px] text-gray-800 font-sans aspect-[1/1.414] select-none pointer-events-none">
            {/* Live rendered mockup matching real A4 print layout */}
            <div className="h-full flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b border-gray-100">
                  <div>
                    <div className="h-6 w-6 rounded bg-[#100e09] flex items-center justify-center text-[#f5f4eb] font-bold text-xs">{currency === 'BDT' ? '৳' : '$'}</div>
                    <span className="block font-bold text-sm mt-1">
                      {activeEntity ? activeEntity.legal_name : (currency === 'BDT' ? 'Corevow Limited' : 'Corevow LLC')}
                    </span>
                    <span className="text-gray-450 block leading-tight text-[8px] whitespace-pre-line mt-0.5">
                      {activeEntity ? activeEntity.registered_address : (currency === 'BDT' ? 'Banani, Dhaka, Bangladesh' : 'Broadway, NY, USA')}
                    </span>
                  </div>

                  <div className="text-right">
                    <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wide">INVOICE</h2>
                    <span className="block text-[8px] mt-1 text-gray-500">Draft Number Sequence</span>
                    <span className="block text-[8px] text-gray-500">Date: {issueDate}</span>
                  </div>
                </div>

                {/* Bill To */}
                <div className="grid grid-cols-2 gap-4 py-4 border-b border-gray-100 text-[8px]">
                  <div>
                    <span className="font-bold text-gray-400 uppercase block">BILL TO:</span>
                    <p className="font-bold text-gray-800 mt-0.5">
                      {activeClient ? (activeClient.company_name || activeClient.contact_person) : 'Client Name'}
                    </p>
                    <p className="text-gray-500 block truncate mt-0.5">{activeClient?.billing_email || 'accounting@client.com'}</p>
                    <p className="text-gray-500 block truncate mt-0.5">{activeClient?.billing_address || 'Address Line'}</p>
                  </div>
                  <div>
                    <span className="font-bold text-gray-400 uppercase block">PROJECT INFORMATION:</span>
                    <p className="font-bold mt-0.5 text-gray-700">Project: {projectName || 'iOS App Development'}</p>
                    <p className="text-gray-500 mt-0.5">Service Period: {servicePeriod || 'Current Period'}</p>
                  </div>
                </div>

                {/* Items list */}
                <table className="w-full text-left text-[8px] border-collapse mt-4">
                  <thead>
                    <tr className="border-b border-gray-100 font-bold text-gray-400 uppercase">
                      <th className="py-1">Service & Description</th>
                      <th className="py-1 text-right">Qty</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((itm, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5">
                          <span className="font-bold block">{itm.service_name || 'Line Item Service'}</span>
                          <span className="text-gray-450 block text-[7px]">{itm.description}</span>
                        </td>
                        <td className="py-1.5 text-right">{itm.quantity} {itm.unit}</td>
                        <td className="py-1.5 text-right">{formatCurrency(itm.rate, currency)}</td>
                        <td className="py-1.5 text-right font-bold">{formatCurrency(itm.quantity * itm.rate, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Calculations */}
              <div>
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <div className="w-40 space-y-1.5 text-[8px]">
                    <div className="flex justify-between">
                      <span className="text-gray-450">Subtotal:</span>
                      <span className="font-bold">{formatCurrency(totals.subtotal, currency)}</span>
                    </div>
                    {discountType !== 'none' && (
                      <div className="flex justify-between text-[#100e09]">
                        <span>Discount:</span>
                        <span>-{formatCurrency(totals.discountAmount, currency)}</span>
                      </div>
                    )}
                    {currency === 'BDT' && vatRate > 0 && (
                      <div className="flex justify-between text-gray-450">
                        <span>VAT ({vatRate}% {vatInclusive ? 'Included' : 'Exclusive'}):</span>
                        <span>{formatCurrency(totals.vatAmount, currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-100 pt-1 text-xs font-extrabold text-[#100e09]">
                      <span>Total Payable:</span>
                      <span>{formatCurrency(totals.totalPayable, currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-gray-100 text-[6px] text-gray-400 text-center leading-normal">
                  <p className="font-bold text-[#100e09]">
                    {activeEntity ? activeEntity.legal_name : (currency === 'BDT' ? 'Corevow Limited' : 'Corevow LLC')}
                  </p>
                  <p className="mt-1">
                    {activeEntity ? activeEntity.vat_footer : (currency === 'BDT' ? 'All rates are inclusive of applicable VAT in accordance with prevailing laws.' : 'All rates are inclusive of applicable taxes.')}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Paid Media Marketing & Digital Media Buying Segment Modal */}
      {showPaidMediaModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50 no-print">
          <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="font-bold text-sm text-gray-900 flex items-center space-x-2">
                <Megaphone className="h-4.5 w-4.5 text-amber-600" />
                <span>Paid Media Marketing & Buying Calculator</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPaidMediaModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Ad Platform</label>
                <select
                  value={mediaPlatform}
                  onChange={(e) => setMediaPlatform(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-[#1E1E1E] focus:outline-none"
                >
                  <option value="Meta Ads (FB/Instagram)">Meta Ads (Facebook & Instagram)</option>
                  <option value="Google Ads (Search/Display/YouTube)">Google Ads (Search, Display, YouTube)</option>
                  <option value="TikTok Ads">TikTok Ads</option>
                  <option value="LinkedIn Ads">LinkedIn Ads</option>
                  <option value="Twitter/X Ads">Twitter / X Ads</option>
                  <option value="Digital Media Buying">Digital Media Buying (General)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Ad Media Budget (USD)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs font-bold text-gray-400">$</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={mediaUsdBudget}
                      onChange={(e) => setMediaUsdBudget(parseFloat(e.target.value) || 0)}
                      className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 pl-6 pr-2.5 text-xs font-bold text-[#1E1E1E] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">USD Exchange Rate (BDT)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs font-bold text-gray-400">৳</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={mediaUsdRate}
                      onChange={(e) => setMediaUsdRate(parseFloat(e.target.value) || 125.5)}
                      className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 pl-6 pr-2.5 text-xs font-bold text-[#1E1E1E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Agency Management Fee (%)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={mediaFeePercent}
                    onChange={(e) => setMediaFeePercent(parseFloat(e.target.value) || 0)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs font-bold text-[#1E1E1E] focus:outline-none"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Platform VAT / Tax (%)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={mediaVatPercent}
                    onChange={(e) => setMediaVatPercent(parseFloat(e.target.value) || 0)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs font-bold text-[#1E1E1E] focus:outline-none"
                    placeholder="15"
                  />
                </div>
              </div>

              {/* Conversion calculation summary */}
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Media Spend (${mediaUsdBudget.toLocaleString()} USD):</span>
                  <span className="font-bold text-gray-900">৳{(mediaUsdBudget * mediaUsdRate).toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT</span>
                </div>
                {mediaFeePercent > 0 && (
                  <div className="flex justify-between text-amber-900">
                    <span>Agency Fee ({mediaFeePercent}%):</span>
                    <span className="font-bold">৳{(((mediaUsdBudget * mediaUsdRate) * mediaFeePercent) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT</span>
                  </div>
                )}
                {mediaVatPercent > 0 && (
                  <div className="flex justify-between text-purple-900">
                    <span>Platform VAT ({mediaVatPercent}%):</span>
                    <span className="font-bold">৳{(((mediaUsdBudget * mediaUsdRate) * mediaVatPercent) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-amber-200 flex justify-between font-extrabold text-sm text-[#100e09]">
                  <span>Total Segment Payable:</span>
                  <span>৳{((mediaUsdBudget * mediaUsdRate) * (1 + (mediaFeePercent + mediaVatPercent) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT</span>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaidMediaModal(false)}
                  className="rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-4 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInsertPaidMedia}
                  className="rounded-lg bg-amber-600 py-2 px-5 font-bold text-[#f5f4eb] hover:bg-amber-700 shadow-sm transition cursor-pointer flex items-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Insert Line Items</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
