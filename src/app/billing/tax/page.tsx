'use client';

import { useState, useEffect } from 'react';
import {
  db, Invoice, Payment, InvoiceItem, TaxPayment, BusinessEntity, Profile, Expense, BillingClient,
  TaxConfiguration, TaxServiceCategory, TaxCalculation, TaxAuditLog,
  VatRegistrationProfile, VatConfiguration, VatServiceCategory, VatDocument, InputVatEntry, VatReturn, VatAuditLog
} from '@/lib/db';
import { calculateTotals, formatCurrency, calculateBangladeshCorporateTax, BdCorporateTaxResult } from '@/lib/calculations';
import NotificationModal from '@/components/NotificationModal';
import {
  Calculator, TrendingUp, DollarSign, CheckCircle, Plus,
  Receipt, AlertCircle, Loader2, Calendar, Download, Pencil, Globe,
  Scale, ShieldCheck, ArrowRight, Info, X, Settings, History, Lock, Send, HelpCircle, FileText, Check, ShieldAlert
} from 'lucide-react';

type TabView = 'vat_tracker' | 'mushak_vds' | 'input_vat' | 'vat_config' | 'income_tax';

function StatCard({ label, amount, sub, color, icon: Icon, badge }: {
  label: string; amount: string; sub?: string; color: string; icon: React.ElementType;
  badge?: { text: string; type: 'warn' | 'ok' | 'info' };
}) {
  return (
    <div className="rounded-2xl border border-gray-100 p-5 bg-[#f5f4eb] shadow-2xs flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${color}`}><Icon className="h-5 w-5 text-[#f5f4eb]" /></div>
        {badge && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border
            ${badge.type === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              badge.type === 'ok' ? 'bg-green-50 text-green-700 border-green-200' :
              'bg-blue-50 text-blue-700 border-blue-200'}`}>{badge.text}</span>
        )}
      </div>
      <div>
        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{amount}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function TaxLedgerPage() {
  const [activeTab, setActiveTab] = useState<TabView>('vat_tracker');
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Core Database Collections
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allItems, setAllItems] = useState<InvoiceItem[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [taxPayments, setTaxPayments] = useState<TaxPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Financial-Year Based Tax & VAT Data
  const [financialYear, setFinancialYear] = useState<string>('2026-2027');
  const financialYears = ['2026-2027', '2025-2026', '2024-2025'];
  const [breakdownYear, setBreakdownYear] = useState(new Date().getFullYear());

  // VAT Profile & Configurations
  const [vatProfile, setVatProfile] = useState<VatRegistrationProfile | null>(null);
  const [vatConfigs, setVatConfigs] = useState<VatConfiguration[]>([]);
  const [activeVatConfig, setActiveVatConfig] = useState<VatConfiguration | null>(null);
  const [vatCategories, setVatCategories] = useState<VatServiceCategory[]>([]);
  const [vatDocuments, setVatDocuments] = useState<VatDocument[]>([]);
  const [inputVatEntries, setInputVatEntries] = useState<InputVatEntry[]>([]);
  const [vatAuditLogs, setVatAuditLogs] = useState<VatAuditLog[]>([]);

  // Income Tax Configurations
  const [taxConfigs, setTaxConfigs] = useState<TaxConfiguration[]>([]);
  const [activeTaxConfig, setActiveTaxConfig] = useState<TaxConfiguration | null>(null);
  const [taxAuditLogs, setTaxAuditLogs] = useState<TaxAuditLog[]>([]);

  // Income Tax Calculator Inputs
  const [grossReceipts, setGrossReceipts] = useState<number>(0);
  const [allowableExpenses, setAllowableExpenses] = useState<number>(0);
  const [disallowedExpenses, setDisallowedExpenses] = useState<number>(0);
  const [otherAdjustments, setOtherAdjustments] = useState<number>(0);
  const [allTransactionsViaBank, setAllTransactionsViaBank] = useState<boolean>(true);
  const [certifiedTds, setCertifiedTds] = useState<number>(0);
  const [advanceTaxPaid, setAdvanceTaxPaid] = useState<number>(0);
  const [manualTaxAdjustment, setManualTaxAdjustment] = useState<number>(0);
  const [activeOverrideVal, setActiveOverrideVal] = useState<number | null>(null);
  const [activeOverrideReason, setActiveOverrideReason] = useState<string | null>(null);

  // Modals
  const [showVatConfigModal, setShowVatConfigModal] = useState(false);
  const [vcfgName, setVcfgName] = useState('');
  const [vcfgFy, setVcfgFy] = useState('2026-2027');
  const [vcfgRegType, setVcfgRegType] = useState<'VAT_REGISTERED' | 'TURNOVER_TAX_ENLISTED'>('VAT_REGISTERED');
  const [vcfgFreq, setVcfgFreq] = useState<'MONTHLY' | 'QUARTERLY'>('MONTHLY');
  const [vcfgRef, setVcfgRef] = useState('NBR Value Added Tax Act 2012');
  const [vcfgSummary, setVcfgSummary] = useState('Updated VAT service category rules');
  const [publishVatToNotice, setPublishVatToNotice] = useState(true);

  // VAT & Income Tax Registration Profile Editor Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profBusinessName, setProfBusinessName] = useState('');
  const [profBin, setProfBin] = useState('');
  const [profBinStatus, setProfBinStatus] = useState<VatRegistrationProfile['bin_status']>('VAT_REGISTERED');
  const [profCircle, setProfCircle] = useState('');
  const [profDivision, setProfDivision] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [profEffectiveDate, setProfEffectiveDate] = useState('');
  const [profReturnFreq, setProfReturnFreq] = useState<VatRegistrationProfile['default_return_frequency']>('MONTHLY');
  const [profTin, setProfTin] = useState('');
  const [profTaxZone, setProfTaxZone] = useState('');
  const [profTaxCircle, setProfTaxCircle] = useState('');
  const [profTaxAssessmentYear, setProfTaxAssessmentYear] = useState('');
  const [profCorporateTaxRate, setProfCorporateTaxRate] = useState('30.00');
  const [savingProfile, setSavingProfile] = useState(false);

  const [showDocModal, setShowDocModal] = useState(false);
  const [docType, setDocType] = useState<VatDocument['document_type']>('MUSHAK_6_6');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [docAmount, setDocAmount] = useState('');
  const [docClientId, setDocClientId] = useState('');
  const [docTaxPeriod, setDocTaxPeriod] = useState(`July ${new Date().getFullYear()}`);

  const [showInputVatModal, setShowInputVatModal] = useState(false);
  const [ivVendor, setIvVendor] = useState('');
  const [ivBin, setIvBin] = useState('');
  const [ivInvRef, setIvInvRef] = useState('');
  const [ivMushakRef, setIvMushakRef] = useState('');
  const [ivDate, setIvDate] = useState(new Date().toISOString().slice(0, 10));
  const [ivTaxableVal, setIvTaxableVal] = useState('');
  const [ivVatAmount, setIvVatAmount] = useState('');

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [formEntityId, setFormEntityId] = useState('');
  const [formTaxType, setFormTaxType] = useState<'VAT' | 'Corporate Tax'>('VAT');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formChallan, setFormChallan] = useState('');
  const [formPeriodStart, setFormPeriodStart] = useState('');
  const [formPeriodEnd, setFormPeriodEnd] = useState('');

  const [modalState, setModalState] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string; }>({ isOpen: false, type: 'info', title: '', message: '' });
  const showNotif = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => setModalState({ isOpen: true, title, message, type });

  const openProfileModal = () => {
    setProfBusinessName(vatProfile?.business_name || 'Corevow Limited');
    setProfBin(vatProfile?.bin_number || '');
    setProfBinStatus(vatProfile?.bin_status || 'VAT_REGISTERED');
    setProfCircle(vatProfile?.vat_circle || '');
    setProfDivision(vatProfile?.vat_division || '');
    setProfAddress(vatProfile?.registered_address || '');
    setProfEffectiveDate(vatProfile?.registration_effective_date || '');
    setProfReturnFreq(vatProfile?.default_return_frequency || 'MONTHLY');
    setProfTin(vatProfile?.tin_number || '');
    setProfTaxZone(vatProfile?.tax_zone || '');
    setProfTaxCircle(vatProfile?.tax_circle || '');
    setProfTaxAssessmentYear(vatProfile?.tax_assessment_year || '2025-2026');
    setProfCorporateTaxRate((vatProfile?.corporate_tax_rate ?? 30.0).toString());
    setShowProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    if (!profBin.trim()) {
      showNotif('Validation Error', 'BIN Number is required.', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await db.saveVatRegistrationProfile({
        business_name: profBusinessName,
        bin_number: profBin.trim(),
        bin_status: profBinStatus,
        vat_circle: profCircle,
        vat_division: profDivision,
        registered_address: profAddress,
        registration_effective_date: profEffectiveDate,
        default_return_frequency: profReturnFreq,
        tin_number: profTin.trim(),
        tax_zone: profTaxZone.trim(),
        tax_circle: profTaxCircle.trim(),
        tax_assessment_year: profTaxAssessmentYear.trim(),
        corporate_tax_rate: parseFloat(profCorporateTaxRate) || 30.0,
        status: 'ACTIVE'
      }, currentUser);
      setVatProfile(updated);
      setShowProfileModal(false);
      showNotif('Tax Profile Updated', `BIN ${updated.bin_number} & TIN ${updated.tin_number || 'N/A'} saved successfully.`, 'success');
    } catch (e) {
      showNotif('Error', 'Failed to save Tax registration profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const canManageTax = currentUser && ['Super Admin', 'Admin', 'Finance Admin'].includes(currentUser.role_name);

  useEffect(() => {
    async function loadData() {
      try {
        const [
          user, invs, pays, exps, ents, taxPays, tCfgs, tLogs, cls,
          prof, vCfgs, vCats, vDocs, iEntries, vLogs
        ] = await Promise.all([
          db.getCurrentUser(),
          db.getInvoices(),
          db.getPayments(),
          db.getExpenses(),
          db.getEntities(),
          db.getTaxPayments(),
          db.getTaxConfigurations(),
          db.getTaxAuditLogs(),
          db.getClients(),
          db.getVatRegistrationProfile(),
          db.getVatConfigurations(),
          db.getVatServiceCategories(),
          db.getVatDocuments(),
          db.getInputVatEntries(),
          db.getVatAuditLogs()
        ]);

        setCurrentUser(user);
        setInvoices(invs);
        setAllPayments(pays);
        setExpenses(exps);
        setEntities(ents);
        setTaxPayments(taxPays);
        setTaxConfigs(tCfgs);
        setTaxAuditLogs(tLogs);
        setClients(cls);

        setVatProfile(prof);
        setVatConfigs(vCfgs);
        setVatCategories(vCats);
        setVatDocuments(vDocs);
        setInputVatEntries(iEntries);
        setVatAuditLogs(vLogs);

        const currentActiveTax = tCfgs.find(c => c.financial_year === financialYear && c.status === 'ACTIVE') || tCfgs[0] || null;
        setActiveTaxConfig(currentActiveTax);

        const currentActiveVat = vCfgs.find(c => c.financial_year === financialYear && c.status === 'ACTIVE') || vCfgs[0] || null;
        setActiveVatConfig(currentActiveVat);

        const itemLists = await Promise.all(invs.map(i => db.getInvoiceItems(i.id)));
        const flatItems = itemLists.flat();
        setAllItems(flatItems);

        // ─────────────────────────────────────────────────────────────────
        // GROSS REVENUE (FY) for Tax Ledger = Cashflow GROSS PROFIT
        //
        // Formula (mirrors Cashflow page getInflow logic):
        //   1. For each FY payment → netReceived = amount − processing_fee
        //   2. Extract VAT share from netReceived (proportional to invoice VAT ratio)
        //   3. netIncomingRevenue = Σ netReceived − Σ vatFromNet
        //   4. FY Expenses (BDT, active only)
        //   5. GROSS PROFIT = netIncomingRevenue − fyExpenses
        //      → This is the Gross Revenue used for corporate income tax calculation.
        //
        // Note: allowableExpenses is set to 0 because the expenses are already
        // deducted inside the gross profit figure. User can add disallowed/adjustments
        // manually if required.
        // ─────────────────────────────────────────────────────────────────

        const [startYear] = financialYear.split('-').map(Number);
        const fyStartDate = `${startYear}-07-01`;
        const fyEndDate = `${startYear + 1}-06-30`;

        const fyInvoices = invs.filter(inv =>
          inv.currency === 'BDT' &&
          ['paid', 'partially_paid', 'sent', 'approved', 'overdue'].includes(inv.status) &&
          inv.issue_date >= fyStartDate && inv.issue_date <= fyEndDate
        );


        let fyNetReceived = 0;
        let fyVatFromNet = 0;

        for (const inv of fyInvoices) {
          const items = flatItems.filter(i => i.invoice_id === inv.id);
          const paysForInv = pays.filter(p => p.invoice_id === inv.id);
          const totals = calculateTotals({
            items: items.map(i => ({ quantity: i.quantity, rate: i.rate })),
            discountType: inv.discount_type, discountValue: inv.discount_value,
            vatRate: inv.vat_rate, vatInclusive: inv.vat_inclusive, payments: paysForInv
          });

          // Per-payment net received (mirrors Cashflow getInflow)
          for (const p of paysForInv) {
            if (p.payment_date < fyStartDate || p.payment_date > fyEndDate) continue;
            const pFee = p.processing_fee || 0;
            const pNet = Math.max(0, p.amount - pFee);
            fyNetReceived += pNet;
            // Proportional VAT share from net received
            if (totals.totalPayable > 0 && totals.vatAmount > 0) {
              const vatRatio = totals.vatAmount / totals.totalPayable;
              fyVatFromNet += pNet * vatRatio;
            }
          }
        }

        const fyNetIncoming = Math.max(0, fyNetReceived - fyVatFromNet);

        const fyExpenses = exps
          .filter(e =>
            e.currency === 'BDT' &&
            e.expense_date >= fyStartDate && e.expense_date <= fyEndDate &&
            (!e.deletion_status || e.deletion_status === 'ACTIVE')
          )
          .reduce((sum, e) => sum + e.amount, 0);

        // GROSS PROFIT = Net Incoming (excl. VAT) − Operating Expenses
        const fyGrossProfit = Math.max(0, fyNetIncoming - fyExpenses);

        // grossReceipts → fed into corporate tax engine as Gross Revenue
        setGrossReceipts(fyGrossProfit);
        // allowableExpenses = 0 (already baked into gross profit above)
        setAllowableExpenses(0);


        if (ents[0]) setFormEntityId(ents[0].id);

      } catch (e) {
        console.error('Failed to load VAT & Tax data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [financialYear]);

  // VAT Calculations (Output VAT, Input VAT, VDS Decreasing Adjustments, Net VAT Payable)
  const calculateVatTotals = () => {
    let outputVat = 0;
    const validInvoices = invoices.filter(inv =>
      inv.currency === 'BDT' && ['paid', 'partially_paid', 'sent', 'approved', 'overdue'].includes(inv.status)
    );
    for (const inv of validInvoices) {
      const items = allItems.filter(i => i.invoice_id === inv.id);
      const pays = allPayments.filter(p => p.invoice_id === inv.id);
      const t = calculateTotals({ items: items.map(i => ({ quantity: i.quantity, rate: i.rate })), discountType: inv.discount_type, discountValue: inv.discount_value, vatRate: inv.vat_rate, vatInclusive: inv.vat_inclusive, payments: pays });
      outputVat += t.vatAmount;
    }

    const eligibleInputVat = inputVatEntries
      .filter(e => e.eligibility_status === 'ELIGIBLE_INPUT_CREDIT' || e.eligibility_status === 'PARTIALLY_ELIGIBLE')
      .reduce((sum, e) => sum + e.approved_input_vat, 0);

    const verifiedVdsAdjustments = vatDocuments
      .filter(d => d.document_type === 'MUSHAK_6_6' && d.verification_status === 'VERIFIED')
      .reduce((sum, d) => sum + d.amount, 0);

    const totalVatPaid = taxPayments.filter(tp => tp.tax_type === 'VAT').reduce((s, tp) => s + tp.amount, 0);
    const netVatPayable = Math.max(0, outputVat - eligibleInputVat - verifiedVdsAdjustments - totalVatPaid);

    return { outputVat, eligibleInputVat, verifiedVdsAdjustments, totalVatPaid, netVatPayable };
  };

  const vatStats = calculateVatTotals();

  // Corporate Tax Calculations
  const bankRate = activeTaxConfig ? activeTaxConfig.bank_compliant_tax_rate : 0.25;
  const stdRate = activeTaxConfig ? activeTaxConfig.standard_tax_rate : 0.275;
  const turnThreshold = activeTaxConfig ? activeTaxConfig.turnover_threshold : 5000000;
  const turnRate = activeTaxConfig ? activeTaxConfig.turnover_minimum_rate : 0.006;

  const taxResult: BdCorporateTaxResult = calculateBangladeshCorporateTax({
    grossReceipts,
    allowableExpenses,
    disallowedExpenses,
    otherAdjustments,
    allTransactionsViaBank,
    bankCompliantTaxRate: bankRate,
    standardTaxRate: stdRate,
    turnoverThreshold: turnThreshold,
    turnoverMinimumTaxRate: turnRate,
    certifiedTds,
    advanceTaxPaid,
    manualTaxAdjustment,
    manualOverrideTax: activeOverrideVal
  });

  const totalCorpTaxPaid = taxPayments.filter(tp => tp.tax_type === 'Corporate Tax').reduce((s, tp) => s + tp.amount, 0);
  const taxBalance = taxResult.finalTaxPayable - totalCorpTaxPaid;

  // Monthly Breakdown
  const monthlyBreakdown = Array.from({ length: 12 }, (_, m) => {
    const monthName = new Date(breakdownYear, m, 1).toLocaleString('default', { month: 'long' });
    const monthInvoices = invoices.filter(inv => {
      const d = new Date(inv.issue_date);
      return inv.currency === 'BDT' && d.getFullYear() === breakdownYear && d.getMonth() === m && ['paid', 'partially_paid', 'sent', 'approved', 'overdue'].includes(inv.status);
    });

    let rev = 0;
    let vat = 0;
    for (const inv of monthInvoices) {
      const items = allItems.filter(i => i.invoice_id === inv.id);
      const pays = allPayments.filter(p => p.invoice_id === inv.id);
      const t = calculateTotals({ items: items.map(i => ({ quantity: i.quantity, rate: i.rate })), discountType: inv.discount_type, discountValue: inv.discount_value, vatRate: inv.vat_rate, vatInclusive: inv.vat_inclusive, payments: pays });
      rev += t.totalPayable;
      vat += t.vatAmount;
    }
    return { month: monthName, revenue: rev, vatAccrued: vat };
  });

  // Handlers for Save operations
  const handleSaveVatConfig = async () => {
    if (!canManageTax) {
      showNotif('Access Denied', 'Only authorized finance administrators can update VAT configurations.', 'error');
      return;
    }
    try {
      const saved = await db.saveVatConfiguration({
        financial_year: vcfgFy,
        configuration_name: vcfgName || `NBR VAT Config FY ${vcfgFy}`,
        registration_type: vcfgRegType,
        return_frequency: vcfgFreq,
        source_reference: vcfgRef,
        change_summary: vcfgSummary,
        status: 'ACTIVE'
      }, currentUser!);

      if (publishVatToNotice) {
        await db.publishVatNotice(saved, currentUser!);
      }

      const refreshed = await db.getVatConfigurations();
      setVatConfigs(refreshed);
      setActiveVatConfig(saved);
      setShowVatConfigModal(false);
      showNotif('VAT Configuration Activated', `Financial Year ${vcfgFy} VAT configuration is now live. Rate notice published to Notice Board.`, 'success');
    } catch (e) {
      showNotif('Error', 'Failed to save VAT configuration.', 'error');
    }
  };

  const handleSaveVatDocument = async () => {
    if (!docNumber || !docAmount) {
      showNotif('Validation Error', 'Document number and amount are required.', 'error');
      return;
    }
    try {
      const amt = parseFloat(docAmount);
      await db.saveVatDocument({
        document_type: docType,
        document_number: docNumber,
        document_date: docDate,
        tax_period: docTaxPeriod,
        amount: amt,
        client_id: docClientId,
        verification_status: docType === 'MUSHAK_6_6' ? 'PENDING' : 'RECEIVED'
      }, currentUser!);

      const refreshed = await db.getVatDocuments();
      setVatDocuments(refreshed);
      setShowDocModal(false);
      setDocNumber(''); setDocAmount('');
      showNotif('Document Saved', `${docType} #${docNumber} recorded successfully.`, 'success');
    } catch (e: any) {
      showNotif('Duplicate / Validation Error', e.message || 'Failed to save document.', 'error');
    }
  };

  const handleSaveInputVat = async () => {
    if (!ivVendor || !ivBin || !ivVatAmount) {
      showNotif('Validation Error', 'Vendor name, Vendor BIN, and Input VAT Amount are required.', 'error');
      return;
    }
    try {
      const vatAmt = parseFloat(ivVatAmount);
      const taxVal = parseFloat(ivTaxableVal) || 0;
      await db.saveInputVatEntry({
        vendor_name: ivVendor,
        vendor_bin: ivBin,
        purchase_invoice_number: ivInvRef,
        mushak_6_3_number: ivMushakRef,
        purchase_date: ivDate,
        taxable_value: taxVal,
        input_vat_amount: vatAmt,
        approved_input_vat: vatAmt,
        eligibility_status: 'ELIGIBLE_INPUT_CREDIT',
        verification_status: 'PENDING',
        tax_period: `July ${new Date().getFullYear()}`,
        created_by: currentUser?.id || ''
      }, currentUser!);

      const refreshed = await db.getInputVatEntries();
      setInputVatEntries(refreshed);
      setShowInputVatModal(false);
      setIvVendor(''); setIvBin(''); setIvVatAmount('');
      showNotif('Input VAT Entry Recorded', `Input VAT claim of ${formatCurrency(vatAmt, 'BDT')} submitted for verification.`, 'success');
    } catch (e) {
      showNotif('Error', 'Failed to save input VAT entry.', 'error');
    }
  };

  const handleRecordPayment = async () => {
    if (!formAmount || !formChallan || !formDate || !formPeriodStart || !formPeriodEnd) {
      showNotif('Validation Error', 'All fields are required.', 'error');
      return;
    }
    const amount = parseFloat(formAmount);
    try {
      await db.recordTaxPayment({
        entity_id: formEntityId,
        tax_type: formTaxType,
        amount,
        payment_date: formDate,
        challan_number: formChallan,
        period_start: formPeriodStart,
        period_end: formPeriodEnd,
        recorded_by: currentUser?.id || ''
      });
      const refreshed = await db.getTaxPayments();
      setTaxPayments(refreshed);
      setShowRecordModal(false);
      setFormAmount(''); setFormChallan('');
      showNotif('Treasury Payment Recorded', `${formatCurrency(amount, 'BDT')} recorded as ${formTaxType} with Challan #${formChallan}.`, 'success');
    } catch {
      showNotif('Error', 'Failed to record payment.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <NotificationModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onClose={() => setModalState(s => ({ ...s, isOpen: false }))}
      />

      {/* Header */}
      <div className="bg-[#f5f4eb] border-b border-gray-100 px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <Receipt className="h-5.5 w-5.5 text-[#100e09]" />
                Bangladesh VAT &amp; Tax Management System
              </h1>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                BIN: {vatProfile?.bin_number || '001234567-0101'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Corevow Limited · Bangladesh VAT Act 2012 / Rules 2019 &amp; Income Tax Act 2023 Compliance Hub.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-semibold text-gray-500">FY:</span>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="bg-transparent font-extrabold text-gray-900 focus:outline-none cursor-pointer"
              >
                {financialYears.map(fy => (
                  <option key={fy} value={fy}>FY {fy}</option>
                ))}
              </select>
            </div>

            {canManageTax && (
              <button
                onClick={() => {
                  setVcfgFy(financialYear);
                  setShowVatConfigModal(true);
                }}
                className="flex items-center gap-1.5 border border-gray-200 bg-[#f5f4eb] hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                <Settings className="h-3.5 w-3.5 text-gray-500" />
                <span>VAT Configurations</span>
              </button>
            )}

            <button
              onClick={() => setShowRecordModal(true)}
              className="flex items-center gap-1.5 bg-[#100e09] text-[#f5f4eb] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] shadow-sm transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Record Treasury Payment
            </button>
          </div>
        </div>

        {/* Module Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 border-t border-gray-100 pt-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('vat_tracker')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeTab === 'vat_tracker' ? 'bg-[#100e09] text-[#f5f4eb] shadow-2xs' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            VAT Smart Tracker &amp; Return Summary
          </button>
          <button
            onClick={() => setActiveTab('mushak_vds')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeTab === 'mushak_vds' ? 'bg-[#100e09] text-[#f5f4eb] shadow-2xs' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Mushak 6.3 &amp; Mushak 6.6 VDS ({vatDocuments.length})
          </button>
          <button
            onClick={() => setActiveTab('input_vat')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeTab === 'input_vat' ? 'bg-[#100e09] text-[#f5f4eb] shadow-2xs' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Input VAT Purchase Register ({inputVatEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('vat_config')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeTab === 'vat_config' ? 'bg-[#100e09] text-[#f5f4eb] shadow-2xs' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            VAT Service Categories &amp; Rates ({vatCategories.length})
          </button>
          <button
            onClick={() => setActiveTab('income_tax')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeTab === 'income_tax' ? 'bg-[#100e09] text-[#f5f4eb] shadow-2xs' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Corporate Income Tax 3-Route Engine
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 p-4 sm:p-6 space-y-6">

        {/* Legal Disclaimer Banner */}
        <div className="flex items-start gap-3 bg-amber-50/80 border border-amber-200 rounded-2xl px-5 py-4 text-xs text-amber-900">
          <Info className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div className="leading-relaxed">
            <strong>Official NBR VAT Legal Notice:</strong> This module provides estimated VAT calculations based on the selected VAT configuration, service classification, financial year, and available supporting documents. Final VAT classification, input tax eligibility, VDS treatment, zero-rating, adjustments, payable amounts, and return figures must be reviewed by an authorized accountant or VAT professional before submission to the relevant authority.
          </div>
        </div>

        {/* Tab 1: VAT Smart Tracker & Return Summary */}
        {activeTab === 'vat_tracker' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard label="Gross Output VAT (15%)" amount={formatCurrency(vatStats.outputVat, 'BDT')} sub="From BDT sales invoices" color="bg-[#100e09]" icon={Receipt} />
              <StatCard label="Eligible Input VAT Credit" amount={formatCurrency(vatStats.eligibleInputVat, 'BDT')} sub="Approved vendor purchases" color="bg-emerald-600" icon={CheckCircle} />
              <StatCard label="Verified VDS Deductions" amount={formatCurrency(vatStats.verifiedVdsAdjustments, 'BDT')} sub="Mushak 6.6 certificates" color="bg-blue-600" icon={ShieldCheck} />
              <StatCard label="Treasury VAT Paid" amount={formatCurrency(vatStats.totalVatPaid, 'BDT')} sub="Govt. treasury deposits" color="bg-amber-600" icon={DollarSign} badge={{ text: vatStats.totalVatPaid > 0 ? 'DEPOSITED' : 'NOT PAID', type: vatStats.totalVatPaid > 0 ? 'ok' : 'warn' }} />
              <StatCard label="Net VAT Still Payable" amount={formatCurrency(vatStats.netVatPayable, 'BDT')} sub={`After all deductions & payments`} color="bg-purple-600" icon={Calculator} badge={{ text: vatStats.netVatPayable <= 0 ? 'CLEARED' : 'DUE NOW', type: vatStats.netVatPayable <= 0 ? 'ok' : 'warn' }} />
            </div>

            {/* VAT Registration Profile & Active Configuration Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold uppercase tracking-wider text-gray-400 text-[10px]">Tax & VAT Profile</span>
                  {canManageTax && (
                    <button
                      onClick={openProfileModal}
                      title="Edit Tax & VAT Registration Profile"
                      className="flex items-center gap-1 text-[10px] font-bold text-[#100e09] bg-red-50 border border-red-100 hover:bg-red-100 px-2 py-0.5 rounded-lg transition cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" /> Edit Profile
                    </button>
                  )}
                </div>
                <p className="font-extrabold text-gray-900 text-sm">{vatProfile?.business_name || '—'}</p>
                <p className="text-gray-600 text-[11px]">BIN: <strong className="font-mono text-gray-900">{vatProfile?.bin_number || 'Not Configured'}</strong> · TIN: <strong className="font-mono text-gray-900">{vatProfile?.tin_number || 'Not Configured'}</strong></p>
                <p className="text-gray-500 text-[11px]">VAT Circle: {vatProfile?.vat_circle || '—'} · Tax Zone: {vatProfile?.tax_zone || '—'} (Circle {vatProfile?.tax_circle || '—'})</p>
                <p className="text-gray-400 text-[10px]">Assessment: {vatProfile?.tax_assessment_year || '2025-2026'} · Corporate Tax Rate: {vatProfile?.corporate_tax_rate ?? 30.0}%</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  vatProfile?.bin_status === 'VAT_REGISTERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  vatProfile?.bin_status === 'SUSPENDED' ? 'bg-red-50 text-red-700 border-red-200' :
                  vatProfile?.bin_status === 'REGISTRATION_PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {vatProfile?.bin_status || 'NOT_CONFIGURED'}
                </span>
              </div>

              <div className="md:col-span-2 bg-[#f5f4eb] rounded-2xl border border-gray-100 p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 text-sm">{activeVatConfig?.configuration_name || `NBR VAT Config FY ${financialYear}`}</span>
                    <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold uppercase text-[10px]">
                      v{activeVatConfig?.version_number || 1} ACTIVE
                    </span>
                  </div>
                  <p className="text-gray-500 mt-1">
                    Registration Type: <strong>{activeVatConfig?.registration_type}</strong> · Return Frequency: <strong>{activeVatConfig?.return_frequency}</strong> · Effective From: <strong>{activeVatConfig?.effective_from}</strong>
                  </p>
                  <p className="text-gray-400 text-[11px] mt-0.5">Source: {activeVatConfig?.source_reference}</p>
                </div>

                {canManageTax && activeVatConfig && (
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        await db.publishVatNotice(activeVatConfig, currentUser!);
                        showNotif('Notice Broadcasted', `VAT parameters for FY ${financialYear} published to Notice Board.`, 'success');
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#100e09] bg-[#100e09]/5 border border-[#100e09]/20 hover:bg-[#100e09]/10 px-3.5 py-2 rounded-xl transition cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Publish Rate Update to Notice Board</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Formulated VAT Return Summary Box */}
            <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-2xs p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="flex items-center gap-2">
                  <Calculator className="h-4.5 w-4.5 text-[#100e09]" />
                  Estimated Monthly VAT Return Formulation (Form Mushak 9.1 Summary)
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  Financial Year {financialYear}
                </span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600 font-medium">1. Gross Output VAT (Sales Invoices):</span>
                  <span className="font-extrabold text-gray-900">{formatCurrency(vatStats.outputVat, 'BDT')}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 text-emerald-700">
                  <span className="font-medium">2. Less: Approved Eligible Input VAT (Vendor Purchases):</span>
                  <span className="font-extrabold">-{formatCurrency(vatStats.eligibleInputVat, 'BDT')}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 text-blue-700">
                  <span className="font-medium">3. Less: Verified VDS Decreasing Adjustments (Mushak 6.6 Certificates):</span>
                  <span className="font-extrabold">-{formatCurrency(vatStats.verifiedVdsAdjustments, 'BDT')}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 text-amber-700">
                  <span className="font-medium">4. Less: Government Treasury Payments Deposited:</span>
                  <span className="font-extrabold">-{formatCurrency(vatStats.totalVatPaid, 'BDT')}</span>
                </div>
                <div className="flex justify-between py-3 rounded-xl bg-gray-50 px-4 text-sm font-black text-[#100e09]">
                  <span>Net Estimated VAT Payable (Part 5):</span>
                  <span>{formatCurrency(vatStats.netVatPayable, 'BDT')}</span>
                </div>
              </div>
            </div>

            {/* Monthly Revenue & Accrued VAT Table */}
            <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  Monthly Sales &amp; Output VAT Breakdown ({breakdownYear})
                </h3>
                <select
                  value={breakdownYear}
                  onChange={(e) => setBreakdownYear(parseInt(e.target.value))}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-3 px-4">Month</th>
                      <th className="py-3 px-4 text-right">Revenue (BDT)</th>
                      <th className="py-3 px-4 text-right">Output VAT (15%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyBreakdown.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-gray-800">{row.month}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatCurrency(row.revenue, 'BDT')}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-[#100e09]">{formatCurrency(row.vatAccrued, 'BDT')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Mushak 6.3 & Mushak 6.6 Documents */}
        {activeTab === 'mushak_vds' && (
          <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Mushak 6.3 &amp; Mushak 6.6 VDS Certificate Ledger</h2>
                <p className="text-xs text-gray-400 mt-0.5">Manage official sales VAT invoices (Mushak 6.3) and verified client withholding certificates (Mushak 6.6).</p>
              </div>
              <button
                onClick={() => setShowDocModal(true)}
                className="flex items-center gap-1.5 bg-[#100e09] text-[#f5f4eb] px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-[#7d1219] shadow-sm transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Record VAT Certificate
              </button>
            </div>

            {vatDocuments.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs font-semibold">
                No Mushak documents uploaded yet. Click &quot;Record VAT Certificate&quot; to log client withholding or sales invoices.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-3 px-4">Doc Type</th>
                      <th className="py-3 px-4">Doc Number</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Tax Period</th>
                      <th className="py-3 px-4 text-right">VDS Amount</th>
                      <th className="py-3 px-4">Verification</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatDocuments.map(doc => (
                      <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] border ${doc.document_type === 'MUSHAK_6_6' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {doc.document_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-extrabold text-gray-900">{doc.document_number}</td>
                        <td className="py-3.5 px-4 text-gray-600">{doc.document_date}</td>
                        <td className="py-3.5 px-4 text-gray-600">{doc.tax_period}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-blue-700">{formatCurrency(doc.amount, 'BDT')}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${doc.verification_status === 'VERIFIED' ? 'bg-green-50 text-green-700 border-green-200' : doc.verification_status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {doc.verification_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {canManageTax && doc.verification_status === 'PENDING' && (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={async () => {
                                  await db.verifyVatDocument(doc.id, 'VERIFIED', currentUser!);
                                  const refreshed = await db.getVatDocuments();
                                  setVatDocuments(refreshed);
                                  showNotif('Certificate Verified', `Mushak 6.6 #${doc.document_number} verified for return deduction.`, 'success');
                                }}
                                className="px-2 py-1 rounded bg-green-600 text-[#f5f4eb] font-bold text-[10px] hover:bg-green-700"
                              >
                                Verify
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Input VAT Purchase Register */}
        {activeTab === 'input_vat' && (
          <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Vendor Purchase Input VAT Register</h2>
                <p className="text-xs text-gray-400 mt-0.5">Track vendor purchases, verify BIN compliance, and record input tax credits for VAT return Part 3.</p>
              </div>
              <button
                onClick={() => setShowInputVatModal(true)}
                className="flex items-center gap-1.5 bg-[#100e09] text-[#f5f4eb] px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-[#7d1219] shadow-sm transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Record Input VAT Entry
              </button>
            </div>

            {inputVatEntries.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs font-semibold">
                No input VAT entries logged. Click &quot;Record Input VAT Entry&quot; to submit vendor purchase tax records.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-3 px-4">Vendor Name</th>
                      <th className="py-3 px-4">Vendor BIN</th>
                      <th className="py-3 px-4">Inv # / Mushak 6.3</th>
                      <th className="py-3 px-4 text-right">Taxable Value</th>
                      <th className="py-3 px-4 text-right">Input VAT</th>
                      <th className="py-3 px-4">Eligibility</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputVatEntries.map(entry => (
                      <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-gray-900">{entry.vendor_name}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-700">{entry.vendor_bin}</td>
                        <td className="py-3.5 px-4 text-gray-600">{entry.mushak_6_3_number || entry.purchase_invoice_number}</td>
                        <td className="py-3.5 px-4 text-right font-semibold text-gray-900">{formatCurrency(entry.taxable_value, 'BDT')}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">{formatCurrency(entry.approved_input_vat, 'BDT')}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${entry.eligibility_status === 'ELIGIBLE_INPUT_CREDIT' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {entry.eligibility_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {canManageTax && entry.verification_status === 'PENDING' && (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={async () => {
                                  await db.approveInputVatEntry(entry.id, entry.input_vat_amount, 'ELIGIBLE_INPUT_CREDIT', currentUser!);
                                  const refreshed = await db.getInputVatEntries();
                                  setInputVatEntries(refreshed);
                                  showNotif('Input VAT Approved', `Input VAT credit of ${formatCurrency(entry.input_vat_amount, 'BDT')} approved.`, 'success');
                                }}
                                className="px-2 py-1 rounded bg-green-600 text-[#f5f4eb] font-bold text-[10px] hover:bg-green-700"
                              >
                                Approve Credit
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: VAT Configurations & Service Categories */}
        {activeTab === 'vat_config' && (
          <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900">VAT Service Categories &amp; Official NBR Rates</h2>
                <p className="text-xs text-gray-400 mt-0.5">Central service classification repository. Rates are dynamically consumed by invoices and notice board.</p>
              </div>
              {canManageTax && (
                <button
                  onClick={() => setShowVatConfigModal(true)}
                  className="flex items-center gap-1.5 bg-[#100e09] text-[#f5f4eb] px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-[#7d1219] shadow-sm transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Edit VAT Configuration
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-4">Service Category</th>
                    <th className="py-3 px-4">NBR Service Code</th>
                    <th className="py-3 px-4">VAT Rate</th>
                    <th className="py-3 px-4">VDS Rate</th>
                    <th className="py-3 px-4">Input Credit</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vatCategories.map(cat => (
                    <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-gray-900">{cat.category_name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700">{cat.official_service_code}</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#100e09]">{(cat.vat_rate * 100).toFixed(1)}%</td>
                      <td className="py-3.5 px-4 font-extrabold text-blue-700">{(cat.vds_rate * 100).toFixed(1)}%</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.is_input_credit_allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {cat.is_input_credit_allowed ? 'Allowed' : 'Not Allowed'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                          {cat.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Corporate Income Tax Engine */}
        {activeTab === 'income_tax' && (
          <div className="space-y-6">
            {/* Income Tax Dashboard Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Gross Revenue (FY)" amount={formatCurrency(grossReceipts, 'BDT')} sub={`Cashflow Gross Profit · FY ${financialYear}`} color="bg-[#100e09]" icon={TrendingUp} />
              <StatCard label="Taxable Profit" amount={formatCurrency(taxResult.taxableProfitForTax, 'BDT')} sub={`Accounting Profit: ${formatCurrency(taxResult.accountingProfit, 'BDT')}`} color="bg-blue-600" icon={Scale} />
              <StatCard label="Final Tax Payable" amount={formatCurrency(taxResult.finalTaxPayable, 'BDT')} sub={`Route: ${taxResult.liabilityDeterminedBy.replace(/_/g, ' ')}`} color="bg-amber-600" icon={Calculator} badge={{ text: taxResult.liabilityDeterminedBy === 'REGULAR_CORPORATE_TAX' ? '25% / 27.5%' : taxResult.liabilityDeterminedBy === 'TURNOVER_MINIMUM_TAX' ? '0.60% TURNOVER' : 'SOURCE MIN', type: 'info' }} />
              <StatCard label="Corp. Tax Deposited" amount={formatCurrency(totalCorpTaxPaid, 'BDT')} sub={`Balance: ${formatCurrency(Math.max(0, taxBalance), 'BDT')}`} color="bg-emerald-600" icon={CheckCircle} badge={{ text: taxBalance <= 0 ? 'SETTLED' : 'OUTSTANDING', type: taxBalance <= 0 ? 'ok' : 'warn' }} />
            </div>

            <div className="bg-[#f5f4eb] rounded-2xl border border-gray-100 shadow-2xs p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                <Calculator className="h-4 w-4 text-[#100e09]" />
                Bangladesh Corporate Income Tax 3-Route Calculation Engine (Sec 163)
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  FY {financialYear} · AY {activeTaxConfig?.assessment_year || `${parseInt(financialYear.split('-')[1])}-${parseInt(financialYear.split('-')[1]) + 1}`}
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">Gross Revenue (BDT)</label>
                  <input type="number" min="0" value={grossReceipts} onChange={e => setGrossReceipts(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-extrabold text-gray-900 focus:outline-none" />
                  <p className="text-[10px] text-gray-400 mt-1">Auto-filled: Cashflow Gross Profit for FY (net received excl. VAT − expenses)</p>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">Allowable Expenses (BDT)</label>
                  <input type="number" min="0" value={allowableExpenses} onChange={e => setAllowableExpenses(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-extrabold text-gray-900 focus:outline-none" />
                  <p className="text-[10px] text-gray-400 mt-1">Already deducted in Gross Profit. Add only disallowed adjustments below if needed.</p>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">Disallowed Expenses (BDT)</label>
                  <input type="number" min="0" value={disallowedExpenses} onChange={e => setDisallowedExpenses(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">Other Adjustments (BDT)</label>
                  <input type="number" value={otherAdjustments} onChange={e => setOtherAdjustments(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none" />
                  <p className="text-[10px] text-gray-400 mt-1">+/− adjustments to taxable income</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                <div className={`rounded-xl border-2 p-4 space-y-2 ${taxResult.liabilityDeterminedBy === 'REGULAR_CORPORATE_TAX' ? 'border-[#100e09] bg-red-50/40' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-700">Route 1: Regular Corp. Tax</span>
                    {taxResult.liabilityDeterminedBy === 'REGULAR_CORPORATE_TAX' && <span className="text-[10px] font-extrabold text-[#100e09] bg-red-100 px-1.5 py-0.5 rounded">ACTIVE</span>}
                  </div>
                  <p className="text-xl font-extrabold text-gray-900">{formatCurrency(taxResult.regularCorporateTax, 'BDT')}</p>
                  <p className="text-[10px] text-gray-400">{allTransactionsViaBank ? '25%' : '27.5%'} × Taxable Profit</p>
                </div>
                <div className={`rounded-xl border-2 p-4 space-y-2 ${taxResult.liabilityDeterminedBy === 'SOURCE_MINIMUM_TAX' ? 'border-amber-500 bg-amber-50/40' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-700">Route 2: Source Min. Tax</span>
                    {taxResult.liabilityDeterminedBy === 'SOURCE_MINIMUM_TAX' && <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">ACTIVE</span>}
                  </div>
                  <p className="text-xl font-extrabold text-gray-900">{formatCurrency(taxResult.sourceMinimumTax, 'BDT')}</p>
                  <p className="text-[10px] text-gray-400">TDS deducted at source from invoices</p>
                </div>
                <div className={`rounded-xl border-2 p-4 space-y-2 ${taxResult.liabilityDeterminedBy === 'TURNOVER_MINIMUM_TAX' ? 'border-purple-600 bg-purple-50/40' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-700">Route 3: Turnover Min. Tax</span>
                    {taxResult.liabilityDeterminedBy === 'TURNOVER_MINIMUM_TAX' && <span className="text-[10px] font-extrabold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">ACTIVE</span>}
                  </div>
                  <p className="text-xl font-extrabold text-gray-900">{formatCurrency(taxResult.turnoverMinimumTax, 'BDT')}</p>
                  <p className="text-[10px] text-gray-400">0.60% × Revenue (if ≥ ৳50L)</p>
                </div>
              </div>

              {/* Bank Condition Toggle */}
              <div className="flex items-center gap-3 p-3.5 bg-blue-50 rounded-xl border border-blue-100">
                <input
                  type="checkbox"
                  id="bankToggle"
                  checked={allTransactionsViaBank}
                  onChange={e => setAllTransactionsViaBank(e.target.checked)}
                  className="h-4 w-4 rounded text-[#100e09] cursor-pointer"
                />
                <label htmlFor="bankToggle" className="text-xs font-bold text-blue-900 cursor-pointer">
                  All business transactions conducted through banking channels (qualifies for 25% rate instead of 27.5%)
                </label>
              </div>

              {/* Certified TDS & Advance Tax */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">Certified TDS Received (BDT)</label>
                  <input type="number" min="0" value={certifiedTds} onChange={e => setCertifiedTds(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">Advance Tax Paid (BDT)</label>
                  <input type="number" min="0" value={advanceTaxPaid} onChange={e => setAdvanceTaxPaid(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">Manual Adjustment (BDT)</label>
                  <input type="number" value={manualTaxAdjustment} onChange={e => setManualTaxAdjustment(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none" />
                </div>
              </div>

              {/* Summary Result */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#100e09] text-[#f5f4eb] p-5">
                  <span className="text-[11px] uppercase tracking-wider text-red-200 font-bold block">Final Corporate Income Tax Payable</span>
                  <p className="text-3xl font-black mt-1">{formatCurrency(taxResult.finalTaxPayable, 'BDT')}</p>
                  <p className="text-[11px] text-red-200 mt-1">Gross Liability: {formatCurrency(taxResult.grossTaxLiability, 'BDT')} − Credits: {formatCurrency(taxResult.availableTaxCredit, 'BDT')}</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gross Tax Liability:</span>
                    <span className="font-extrabold text-gray-900">{formatCurrency(taxResult.grossTaxLiability, 'BDT')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Less: Certified TDS + Advance:</span>
                    <span className="font-extrabold">−{formatCurrency(taxResult.availableTaxCredit, 'BDT')}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-bold text-gray-700">Treasury Deposited:</span>
                    <span className="font-extrabold text-amber-700">{formatCurrency(totalCorpTaxPaid, 'BDT')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-700">Outstanding Balance:</span>
                    <span className={`font-black ${taxBalance > 0 ? 'text-[#100e09]' : 'text-emerald-700'}`}>{formatCurrency(Math.max(0, taxBalance), 'BDT')}</span>
                  </div>
                  {taxResult.unadjustedTaxCredit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Unadjusted Credit C/F:</span>
                      <span className="font-bold text-blue-700">{formatCurrency(taxResult.unadjustedTaxCredit, 'BDT')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal A: Record Mushak Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f5f4eb] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">Record VAT Certificate / Document</h3>
              <button onClick={() => setShowDocModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Document Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value as any)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-bold text-gray-900 focus:outline-none">
                  <option value="MUSHAK_6_6">Mushak 6.6 (Client VDS Certificate)</option>
                  <option value="MUSHAK_6_3">Mushak 6.3 (Sales VAT Invoice)</option>
                  <option value="PURCHASE_VAT_INVOICE">Purchase VAT Invoice</option>
                  <option value="ZERO_RATE_EVIDENCE">Zero-Rate Export Remittance Evidence</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Document Number *</label>
                <input type="text" value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="e.g. M6.6-2026-0099" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-mono text-gray-900 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Withholding / VAT Amount (BDT) *</label>
                <input type="number" value={docAmount} onChange={e => setDocAmount(e.target.value)} placeholder="e.g. 15000" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-bold text-gray-900 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Tax Period</label>
                <input type="text" value={docTaxPeriod} onChange={e => setDocTaxPeriod(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowDocModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveVatDocument} className="flex-1 py-2.5 rounded-xl bg-[#100e09] text-[#f5f4eb] text-xs font-bold hover:bg-[#7d1219]">Save Document</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal B: Record Input VAT Purchase Entry */}
      {showInputVatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f5f4eb] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">Record Vendor Input VAT Entry</h3>
              <button onClick={() => setShowInputVatModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Vendor Name *</label>
                <input type="text" value={ivVendor} onChange={e => setIvVendor(e.target.value)} placeholder="e.g. Grameenphone Ltd" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Vendor BIN Number *</label>
                <input type="text" value={ivBin} onChange={e => setIvBin(e.target.value)} placeholder="e.g. 000123456-0202" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-mono text-gray-900 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Taxable Value (BDT)</label>
                  <input type="number" value={ivTaxableVal} onChange={e => setIvTaxableVal(e.target.value)} placeholder="100000" className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Input VAT (BDT) *</label>
                  <input type="number" value={ivVatAmount} onChange={e => setIvVatAmount(e.target.value)} placeholder="15000" className="w-full rounded-xl border border-gray-200 px-3.5 py-2 font-bold text-emerald-700 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Vendor Mushak 6.3 Ref</label>
                <input type="text" value={ivMushakRef} onChange={e => setIvMushakRef(e.target.value)} placeholder="M6.3-88990" className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowInputVatModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveInputVat} className="flex-1 py-2.5 rounded-xl bg-[#100e09] text-[#f5f4eb] text-xs font-bold hover:bg-[#7d1219]">Submit Input VAT</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal C: Edit VAT Configuration Drawer */}
      {showVatConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f5f4eb] rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">Configure Financial Year VAT Parameters</h3>
              <button onClick={() => setShowVatConfigModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Financial Year</label>
                  <input type="text" value={vcfgFy} onChange={e => setVcfgFy(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2 font-bold text-gray-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Return Frequency</label>
                  <select value={vcfgFreq} onChange={e => setVcfgFreq(e.target.value as any)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2 font-bold text-gray-900 focus:outline-none">
                    <option value="MONTHLY">Monthly (Standard)</option>
                    <option value="QUARTERLY">Quarterly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Configuration Name</label>
                <input type="text" value={vcfgName} onChange={e => setVcfgName(e.target.value)} placeholder="NBR Standard VAT Config" className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:outline-none" />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Official NBR Source Reference</label>
                <input type="text" value={vcfgRef} onChange={e => setVcfgRef(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:outline-none" />
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <input type="checkbox" id="pubVatNotice" checked={publishVatToNotice} onChange={e => setPublishVatToNotice(e.target.checked)} className="h-4 w-4 text-[#100e09] rounded focus:ring-[#100e09] cursor-pointer" />
                <label htmlFor="pubVatNotice" className="text-xs font-bold text-blue-900 cursor-pointer">
                  Automatically publish revised VAT rate notice to team Notice Board
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowVatConfigModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveVatConfig} className="flex-1 py-2.5 rounded-xl bg-[#100e09] text-[#f5f4eb] text-xs font-bold hover:bg-[#7d1219]">Activate VAT Configuration</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal D: Record Treasury Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f5f4eb] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">Record Treasury Exchequer Payment</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Tax Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['VAT', 'Corporate Tax'] as const).map(t => (
                    <button key={t} onClick={() => setFormTaxType(t)} className={`py-2.5 rounded-xl font-bold border transition ${formTaxType === t ? 'bg-[#100e09] text-[#f5f4eb] border-[#100e09]' : 'border-gray-200 text-gray-600'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Amount Paid (BDT) *</label>
                <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="50000" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-bold text-gray-900 focus:outline-none" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Challan / Treasury # *</label>
                <input type="text" value={formChallan} onChange={e => setFormChallan(e.target.value)} placeholder="TC-2026-00123" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-mono text-gray-900 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Period Start</label>
                  <input type="date" value={formPeriodStart} onChange={e => setFormPeriodStart(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Period End</label>
                  <input type="date" value={formPeriodEnd} onChange={e => setFormPeriodEnd(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900 focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowRecordModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleRecordPayment} className="flex-1 py-2.5 rounded-xl bg-[#100e09] text-[#f5f4eb] text-xs font-bold hover:bg-[#7d1219]">Save Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal E: Edit VAT Registration Profile */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f5f4eb] rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Edit VAT Registration Profile</h3>
                <p className="text-xs text-gray-400 mt-0.5">BIN · NBR Circle & Division · Return frequency</p>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Registered Business Name</label>
                <input
                  type="text"
                  value={profBusinessName}
                  onChange={e => setProfBusinessName(e.target.value)}
                  placeholder="e.g. Corevow Limited"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#100e09]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">BIN Number *</label>
                  <input
                    type="text"
                    value={profBin}
                    onChange={e => setProfBin(e.target.value)}
                    placeholder="e.g. 001234567-0101"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#100e09]/20"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">BIN Status</label>
                  <select
                    value={profBinStatus}
                    onChange={e => setProfBinStatus(e.target.value as VatRegistrationProfile['bin_status'])}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-bold text-gray-900 focus:outline-none cursor-pointer"
                  >
                    <option value="VAT_REGISTERED">VAT Registered</option>
                    <option value="TURNOVER_TAX_ENLISTED">Turnover Tax Enlisted</option>
                    <option value="VOLUNTARILY_REGISTERED">Voluntarily Registered</option>
                    <option value="REGISTRATION_PENDING">Registration Pending</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="NOT_CONFIGURED">Not Configured</option>
                  </select>
                </div>
              </div>

              {/* Tax & TIN Details */}
              <div className="border-t border-gray-100 pt-3">
                <h4 className="font-extrabold text-gray-900 text-xs mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#100e09]" /> Income Tax & TIN Configuration
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">TIN Number (Taxpayer ID)</label>
                    <input
                      type="text"
                      value={profTin}
                      onChange={e => setProfTin(e.target.value)}
                      placeholder="e.g. 123456789012"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-mono text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Tax Assessment Year</label>
                    <input
                      type="text"
                      value={profTaxAssessmentYear}
                      onChange={e => setProfTaxAssessmentYear(e.target.value)}
                      placeholder="e.g. 2025-2026"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Tax Zone (NBR)</label>
                    <input
                      type="text"
                      value={profTaxZone}
                      onChange={e => setProfTaxZone(e.target.value)}
                      placeholder="e.g. Zone 15, Dhaka"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Tax Circle (NBR)</label>
                    <input
                      type="text"
                      value={profTaxCircle}
                      onChange={e => setProfTaxCircle(e.target.value)}
                      placeholder="e.g. Circle 320"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profCorporateTaxRate}
                      onChange={e => setProfCorporateTaxRate(e.target.value)}
                      placeholder="30.00"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">VAT Circle (NBR)</label>
                  <input
                    type="text"
                    value={profCircle}
                    onChange={e => setProfCircle(e.target.value)}
                    placeholder="e.g. Banani Circle"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">VAT Division (NBR)</label>
                  <input
                    type="text"
                    value={profDivision}
                    onChange={e => setProfDivision(e.target.value)}
                    placeholder="e.g. Dhaka North Division"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Registration Effective Date</label>
                  <input
                    type="date"
                    value={profEffectiveDate}
                    onChange={e => setProfEffectiveDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Default Return Frequency</label>
                  <select
                    value={profReturnFreq}
                    onChange={e => setProfReturnFreq(e.target.value as VatRegistrationProfile['default_return_frequency'])}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-bold text-gray-900 focus:outline-none cursor-pointer"
                  >
                    <option value="MONTHLY">Monthly (Standard)</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="FOUR_MONTHLY">Four Monthly</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Registered Address</label>
                <textarea
                  value={profAddress}
                  onChange={e => setProfAddress(e.target.value)}
                  rows={2}
                  placeholder="Full registered business address as per NBR certificate"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  This profile is stored in your billing database and appears on VAT returns, Mushak document headers, and the Tax Ledger. Ensure BIN matches your official NBR registration certificate exactly.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="flex-1 py-2.5 rounded-xl bg-[#100e09] text-[#f5f4eb] text-xs font-bold hover:bg-[#7d1219] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {savingProfile
                  ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : <Check className="h-3.5 w-3.5" />
                }
                {savingProfile ? 'Saving…' : 'Save VAT Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
