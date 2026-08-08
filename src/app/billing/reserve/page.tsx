'use client';

import { useState, useEffect } from 'react';
import {
  db,
  Profile,
  ReserveSettings,
  ReserveSettingsHistory,
  ReserveLedgerEntry,
  FdrAccount,
  DpsAccount,
  DpsInstallment,
  ReserveWithdrawalRequest,
  SavingsDocument,
  FinancialReconciliation,
  FinancialAuditLog,
  BusinessEntity
} from '@/lib/db';
import {
  Landmark,
  ShieldAlert,
  Wallet,
  PiggyBank,
  TrendingUp,
  Plus,
  Download,
  FileText,
  Clock,
  Search,
  Layers,
  History,
  ShieldCheck,
  Building2,
  Sliders,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function ReserveManagementPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'ledger' | 'fdr' | 'dps' | 'withdrawals' | 'reconciliation' | 'reports' | 'settings' | 'audit_logs'
  >('overview');

  // Global Filters
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<'BDT' | 'USD'>('BDT');

  // Dashboard Aggregated Metrics
  const [summary, setSummary] = useState<any>(null);
  const [entities, setEntities] = useState<BusinessEntity[]>([]);

  // Real-time Data lists
  const [ledger, setLedger] = useState<ReserveLedgerEntry[]>([]);
  const [fdrAccounts, setFdrAccounts] = useState<FdrAccount[]>([]);
  const [dpsAccounts, setDpsAccounts] = useState<DpsAccount[]>([]);
  const [dpsInstallments, setDpsInstallments] = useState<DpsInstallment[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<ReserveWithdrawalRequest[]>([]);
  const [settingsHistory, setSettingsHistory] = useState<ReserveSettingsHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);

  // Search queries
  const [searchLedger, setSearchLedger] = useState('');

  // Modals state
  const [modalType, setModalType] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Edit Targets
  const [editingFdr, setEditingFdr] = useState<FdrAccount | null>(null);
  const [editingDps, setEditingDps] = useState<DpsAccount | null>(null);
  const [editingLedger, setEditingLedger] = useState<ReserveLedgerEntry | null>(null);

  // Form states
  const [manualDepositForm, setManualDepositForm] = useState({
    entity_id: 'a0000070-0000-4000-8000-000000000001',
    currency: 'BDT' as 'BDT' | 'USD',
    amount: 100000,
    source: 'BANK_TRANSFER',
    reason: 'Corporate reserve deposit'
  });

  const [fdrForm, setFdrForm] = useState({
    entity_id: 'a0000070-0000-4000-8000-000000000001',
    bank_name: 'City Bank PLC',
    branch_name: 'Banani Branch',
    account_title: 'app Corporate Reserve FDR',
    fdr_reference_number: `CBL-FDR-${Date.now().toString().slice(-4)}`,
    principal_amount: 500000,
    currency: 'BDT' as 'BDT' | 'USD',
    interest_rate: 8.5,
    tenure_months: 12,
    auto_renewal: true,
    funding_source: 'Company Emergency Reserve',
    notes: 'Fixed deposit asset for corporate reserve yield.'
  });

  const [dpsForm, setDpsForm] = useState({
    entity_id: 'a0000070-0000-4000-8000-000000000001',
    bank_name: 'BRAC Bank PLC',
    branch_name: 'Banani Branch',
    account_title: 'app Corporate DPS',
    dps_account_number: `BRAC-DPS-${Date.now().toString().slice(-4)}`,
    currency: 'BDT' as 'BDT' | 'USD',
    installment_amount: 25000,
    total_installments: 36,
    start_date: new Date().toISOString().split('T')[0],
    funding_source: 'Company Emergency Reserve',
    notes: 'Monthly corporate DPS investment scheme.'
  });

  const [withdrawalForm, setWithdrawalForm] = useState({
    entity_id: 'a0000070-0000-4000-8000-000000000001',
    currency: 'BDT' as 'BDT' | 'USD',
    requested_amount: 100000,
    purpose: 'Emergency Server Infrastructure Upgrade',
    detailed_reason: 'Unforeseen cloud hardware replacement needed immediately.',
    emergency_category: 'EMERGENCY_OPERATIONS' as any,
    destination_account: 'City Bank BDT Operating Account'
  });

  const [settingsForm, setSettingsForm] = useState({
    reserve_percentage: 20.0,
    target_fixed_bdt: 5000000,
    target_fixed_usd: 50000,
    reason: 'Updated corporate allocation policy'
  });

  const [activeFdrForMaturity, setActiveFdrForMaturity] = useState<FdrAccount | null>(null);
  const [maturityForm, setMaturityForm] = useState({
    actual_net_value: 0,
    action: 'CLOSE' as 'CLOSE' | 'RENEW',
    notes: 'Maturity realized and deposited to reserve account.'
  });

  const [activeDpsForPay, setActiveDpsForPay] = useState<DpsInstallment | null>(null);
  const [dpsPayForm, setDpsPayForm] = useState({
    transaction_reference: `TXN-DPS-${Date.now().toString().slice(-6)}`,
    paid_from_account: 'Company Emergency Reserve'
  });

  const [reviewWithdrawalItem, setReviewWithdrawalItem] = useState<ReserveWithdrawalRequest | null>(null);
  const [withdrawalComment, setWithdrawalComment] = useState('');

  useEffect(() => {
    loadAllData();
  }, [selectedEntity, selectedCurrency]);

  const loadAllData = async () => {
    setLoading(true);
    const user = await db.getCurrentUser();
    setCurrentUser(user);

    const entList = await db.getEntities();
    setEntities(entList);

    const smry = await db.getReserveDashboardSummary(selectedEntity, selectedCurrency);
    setSummary(smry);

    const ldg = await db.getReserveLedger();
    setLedger(ldg);

    const fdrs = await db.getFdrAccounts();
    setFdrAccounts(fdrs);

    const dps = await db.getDpsAccounts();
    setDpsAccounts(dps);

    const insts = await db.getDpsInstallments();
    setDpsInstallments(insts);

    const wth = await db.getWithdrawalRequests();
    setWithdrawalRequests(wth);

    const hist = await db.getReserveSettingsHistory();
    setSettingsHistory(hist);

    const audits = await db.getFinancialAuditLogs();
    setAuditLogs(audits);

    if (smry.reserveSettings) {
      setSettingsForm({
        reserve_percentage: smry.reserveSettings.reserve_percentage,
        target_fixed_bdt: smry.reserveSettings.target_fixed_bdt,
        target_fixed_usd: smry.reserveSettings.target_fixed_usd,
        reason: 'Updated corporate reserve percentage'
      });
    }

    setLoading(false);
  };

  const isAllowedRole =
    currentUser &&
    (currentUser.role_name === 'Super Admin' ||
      currentUser.role_name === 'Admin' ||
      currentUser.role_name === 'Finance Admin');

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
          <p className="text-xs font-semibold text-gray-500">Loading live company reserve ledger...</p>
        </div>
      </div>
    );
  }

  // Access control block
  if (!isAllowedRole) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-[#f5f4eb] border border-rose-200 rounded-2xl shadow-xs text-center space-y-4">
        <div className="h-14 w-14 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-extrabold text-gray-900">Confidential Module: Access Denied</h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          The <strong>Company Reserve and Savings Management Module</strong> contains sensitive corporate financial metrics. Access is strictly limited to <strong>Super Admin</strong>, <strong>Admin</strong>, and <strong>Finance Admin</strong>.
        </p>
        <div className="pt-2">
          <span className="text-[11px] font-mono text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 font-bold">
            User Role: {currentUser?.role_name || 'Guest'} (Unauthorized)
          </span>
        </div>
      </div>
    );
  }

  // Modal Open Helpers (Syncing Currency and Entity ID)
  const openManualDepositModal = () => {
    const defaultEntity = entities.find(e => e.entity_code === (selectedCurrency === 'USD' ? 'CLLC' : 'CLTD'))?.id || (selectedCurrency === 'USD' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111');
    setManualDepositForm({
      entity_id: defaultEntity,
      currency: selectedCurrency,
      amount: selectedCurrency === 'USD' ? 1000 : 100000,
      source: 'BANK_TRANSFER',
      reason: 'Corporate reserve deposit'
    });
    setModalType('manual_deposit');
  };

  const openCreateFdrModal = () => {
    const defaultEntity = entities.find(e => e.entity_code === (selectedCurrency === 'USD' ? 'CLLC' : 'CLTD'))?.id || (selectedCurrency === 'USD' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111');
    setFdrForm({
      entity_id: defaultEntity,
      bank_name: selectedCurrency === 'USD' ? 'JP Morgan Chase / Standard Chartered' : 'City Bank PLC',
      branch_name: 'Corporate Branch',
      account_title: `app Corporate ${selectedCurrency} Reserve FDR`,
      fdr_reference_number: `FDR-${selectedCurrency}-${Date.now().toString().slice(-4)}`,
      principal_amount: selectedCurrency === 'USD' ? 5000 : 500000,
      currency: selectedCurrency,
      interest_rate: selectedCurrency === 'USD' ? 5.5 : 8.5,
      tenure_months: 12,
      auto_renewal: true,
      funding_source: 'Company Emergency Reserve',
      notes: 'Fixed deposit asset for corporate reserve yield.'
    });
    setModalType('create_fdr');
  };

  const openCreateDpsModal = () => {
    const defaultEntity = entities.find(e => e.entity_code === (selectedCurrency === 'USD' ? 'CLLC' : 'CLTD'))?.id || (selectedCurrency === 'USD' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111');
    setDpsForm({
      entity_id: defaultEntity,
      bank_name: selectedCurrency === 'USD' ? 'Citibank / HSBC' : 'BRAC Bank PLC',
      branch_name: 'Corporate Branch',
      account_title: `app Corporate ${selectedCurrency} DPS`,
      dps_account_number: `DPS-${selectedCurrency}-${Date.now().toString().slice(-4)}`,
      currency: selectedCurrency,
      installment_amount: selectedCurrency === 'USD' ? 250 : 25000,
      total_installments: 36,
      start_date: new Date().toISOString().split('T')[0],
      funding_source: 'Company Emergency Reserve',
      notes: 'Monthly corporate DPS investment scheme.'
    });
    setModalType('create_dps');
  };

  const openRequestWithdrawalModal = () => {
    const defaultEntity = entities.find(e => e.entity_code === (selectedCurrency === 'USD' ? 'CLLC' : 'CLTD'))?.id || (selectedCurrency === 'USD' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111');
    setWithdrawalForm({
      entity_id: defaultEntity,
      currency: selectedCurrency,
      requested_amount: selectedCurrency === 'USD' ? 1000 : 100000,
      purpose: 'Emergency Server Infrastructure Upgrade',
      detailed_reason: 'Unforeseen cloud hardware replacement needed immediately.',
      emergency_category: 'EMERGENCY_OPERATIONS' as any,
      destination_account: selectedCurrency === 'USD' ? 'Corevow LLC USD Operating Account' : 'City Bank BDT Operating Account'
    });
    setModalType('request_withdrawal');
  };

  // Action Handlers
  const handleCreateManualDeposit = async () => {
    if (!currentUser) return;
    setFormSaving(true);
    try {
      await db.addReserveLedgerEntry(
        {
          entity_id: manualDepositForm.entity_id,
          currency: manualDepositForm.currency,
          transaction_type: 'MANUAL_DEPOSIT',
          amount: manualDepositForm.amount,
          source: manualDepositForm.source,
          deposit_date: new Date().toISOString().split('T')[0],
          reason: manualDepositForm.reason,
          status: 'COMPLETED',
          created_by: currentUser.full_name,
          approved_by: currentUser.full_name
        },
        currentUser
      );
      setModalType(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleUpdateLedger = async () => {
    if (!currentUser || !editingLedger) return;
    setFormSaving(true);
    try {
      await db.updateReserveLedgerEntry(editingLedger.id, editingLedger, currentUser);
      setModalType(null);
      setEditingLedger(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteLedger = async (id: string) => {
    if (!currentUser || !confirm('Are you sure you want to delete this ledger entry?')) return;
    try {
      await db.deleteReserveLedgerEntry(id, currentUser);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateFdr = async () => {
    if (!currentUser) return;
    setFormSaving(true);
    try {
      const grossReturn = Math.round(fdrForm.principal_amount * (fdrForm.interest_rate / 100) * (fdrForm.tenure_months / 12));
      const tax = Math.round(grossReturn * 0.10);
      const charges = 500;
      const netValue = fdrForm.principal_amount + grossReturn - tax - charges;

      const startDate = new Date();
      const maturityDate = new Date();
      maturityDate.setMonth(maturityDate.getMonth() + fdrForm.tenure_months);

      await db.createFdrAccount(
        {
          entity_id: fdrForm.entity_id,
          bank_name: fdrForm.bank_name,
          branch_name: fdrForm.branch_name,
          account_title: fdrForm.account_title,
          fdr_reference_number: fdrForm.fdr_reference_number,
          principal_amount: fdrForm.principal_amount,
          currency: fdrForm.currency,
          interest_rate: fdrForm.interest_rate,
          rate_type: 'SIMPLE',
          start_date: startDate.toISOString().split('T')[0],
          maturity_date: maturityDate.toISOString().split('T')[0],
          tenure_months: fdrForm.tenure_months,
          expected_gross_return: grossReturn,
          expected_tax_deduction: tax,
          expected_bank_charges: charges,
          expected_net_maturity_value: netValue,
          auto_renewal: fdrForm.auto_renewal,
          lien_status: false,
          funding_source: fdrForm.funding_source,
          status: 'ACTIVE',
          notes: fdrForm.notes,
          created_by: currentUser.full_name
        },
        currentUser
      );
      setModalType(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleUpdateFdr = async () => {
    if (!currentUser || !editingFdr) return;
    setFormSaving(true);
    try {
      await db.updateFdrAccount(editingFdr.id, editingFdr, currentUser);
      setModalType(null);
      setEditingFdr(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteFdr = async (id: string) => {
    if (!currentUser || !confirm('Are you sure you want to delete this FDR record?')) return;
    try {
      await db.deleteFdrAccount(id, currentUser);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateDps = async () => {
    if (!currentUser) return;
    setFormSaving(true);
    try {
      const totalDep = dpsForm.installment_amount * dpsForm.total_installments;
      const expectedInt = Math.round(totalDep * 0.12);
      const expectedMat = totalDep + expectedInt;

      const maturityDate = new Date(dpsForm.start_date);
      maturityDate.setMonth(maturityDate.getMonth() + dpsForm.total_installments);

      await db.createDpsAccount(
        {
          entity_id: dpsForm.entity_id,
          bank_name: dpsForm.bank_name,
          branch_name: dpsForm.branch_name,
          account_title: dpsForm.account_title,
          dps_account_number: dpsForm.dps_account_number,
          currency: dpsForm.currency,
          installment_amount: dpsForm.installment_amount,
          payment_frequency: 'MONTHLY',
          start_date: dpsForm.start_date,
          next_installment_date: dpsForm.start_date,
          maturity_date: maturityDate.toISOString().split('T')[0],
          total_installments: dpsForm.total_installments,
          paid_installments: 1,
          remaining_installments: dpsForm.total_installments - 1,
          total_deposited_amount: dpsForm.installment_amount,
          expected_interest_amount: expectedInt,
          expected_maturity_value: expectedMat,
          late_payment_charge: 0,
          missed_installments_count: 0,
          grace_period_days: 5,
          auto_debit: true,
          funding_source: dpsForm.funding_source,
          status: 'ACTIVE',
          notes: dpsForm.notes,
          created_by: currentUser.full_name
        },
        currentUser
      );
      setModalType(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleUpdateDps = async () => {
    if (!currentUser || !editingDps) return;
    setFormSaving(true);
    try {
      await db.updateDpsAccount(editingDps.id, editingDps, currentUser);
      setModalType(null);
      setEditingDps(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteDps = async (id: string) => {
    if (!currentUser || !confirm('Are you sure you want to delete this DPS account?')) return;
    try {
      await db.deleteDpsAccount(id, currentUser);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDpsPaySubmit = async () => {
    if (!currentUser || !activeDpsForPay) return;
    setFormSaving(true);
    try {
      await db.payDpsInstallment(
        activeDpsForPay.id,
        dpsPayForm.transaction_reference,
        dpsPayForm.paid_from_account,
        currentUser
      );
      setModalType(null);
      setActiveDpsForPay(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleCreateWithdrawal = async () => {
    if (!currentUser) return;
    setFormSaving(true);
    try {
      await db.createWithdrawalRequest(
        {
          entity_id: withdrawalForm.entity_id,
          currency: withdrawalForm.currency,
          requested_amount: withdrawalForm.requested_amount,
          purpose: withdrawalForm.purpose,
          detailed_reason: withdrawalForm.detailed_reason,
          emergency_category: withdrawalForm.emergency_category,
          destination_account: withdrawalForm.destination_account,
          requested_by: currentUser.full_name,
          request_date: new Date().toISOString().split('T')[0]
        },
        currentUser
      );
      setModalType(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleReviewWithdrawal = async (status: 'APPROVED' | 'REJECTED') => {
    if (!currentUser || !reviewWithdrawalItem) return;
    setFormSaving(true);
    try {
      await db.reviewWithdrawalRequest(reviewWithdrawalItem.id, status, withdrawalComment, currentUser);
      setModalType(null);
      setReviewWithdrawalItem(null);
      setWithdrawalComment('');
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!currentUser) return;
    setFormSaving(true);
    try {
      await db.updateReserveSettings(
        {
          reserve_percentage: settingsForm.reserve_percentage,
          target_fixed_bdt: settingsForm.target_fixed_bdt,
          target_fixed_usd: settingsForm.target_fixed_usd
        },
        settingsForm.reason,
        currentUser
      );
      setModalType(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleMaturitySubmit = async () => {
    if (!currentUser || !activeFdrForMaturity) return;
    setFormSaving(true);
    try {
      await db.recordFdrMaturity(
        activeFdrForMaturity.id,
        maturityForm.actual_net_value,
        maturityForm.action,
        maturityForm.notes,
        currentUser
      );
      setModalType(null);
      setActiveFdrForMaturity(null);
      await loadAllData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFormSaving(false);
    }
  };

  // CSV Export
  const exportLedgerToCsv = () => {
    const headers = ['Txn ID', 'Entity', 'Currency', 'Type', 'Amount', 'Source', 'Date', 'Status', 'Reason'];
    const rows = ledger.map(l => [
      l.id,
      l.entity_id === 'a0000070-0000-4000-8000-000000000001' ? 'Corevow Limited' : 'Corevow LLC',
      l.currency,
      l.transaction_type,
      l.amount,
      l.source,
      l.deposit_date,
      l.status,
      `"${(l.reason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reserve_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#100e09]/10 text-[#100e09] flex items-center justify-center font-bold">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
                Company Reserve & Savings Management
              </h1>
              <p className="text-xs text-gray-500">
                Live database reserve allocations, 80/20 operating cash engine, FDR & DPS asset portfolios.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: Entity & Currency Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200 text-xs">
            <Building2 className="h-3.5 w-3.5 text-gray-400 ml-1" />
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="bg-transparent font-semibold text-gray-700 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Legal Entities</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>{e.legal_name} ({e.entity_code})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedCurrency('BDT')}
              className={`px-3 py-1.5 rounded-lg transition ${selectedCurrency === 'BDT' ? 'bg-[#100e09] text-[#f5f4eb] shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              BDT (৳)
            </button>
            <button
              onClick={() => setSelectedCurrency('USD')}
              className={`px-3 py-1.5 rounded-lg transition ${selectedCurrency === 'USD' ? 'bg-[#100e09] text-[#f5f4eb] shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              USD ($)
            </button>
          </div>

          <button
            onClick={openManualDepositModal}
            className="flex items-center space-x-1.5 bg-[#100e09] text-[#f5f4eb] px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] transition shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Manual Deposit</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-gray-200 pb-2 scrollbar-none">
        {[
          { id: 'overview', label: 'Overview & KPIs', icon: Landmark },
          { id: 'ledger', label: 'Reserve Ledger', icon: Layers },
          { id: 'fdr', label: 'FDR Portfolio', icon: Wallet },
          { id: 'dps', label: 'DPS Savings', icon: PiggyBank },
          { id: 'withdrawals', label: 'Withdrawals', icon: Clock },
          { id: 'reports', label: 'Reports', icon: FileText },
          { id: 'settings', label: 'Policy Settings', icon: Sliders },
          { id: 'audit_logs', label: 'Audit Logs', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-[#100e09] text-[#f5f4eb] shadow-xs'
                  : 'bg-[#f5f4eb] text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.id === 'withdrawals' && withdrawalRequests.filter(w => w.status === 'SUBMITTED').length > 0 && (
                <span className="ml-1 bg-amber-500 text-[#f5f4eb] text-[9px] px-1.5 py-0.2 rounded-full font-extrabold">
                  {withdrawalRequests.filter(w => w.status === 'SUBMITTED').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & DASHBOARD */}
      {activeTab === 'overview' && summary && (
        <div className="space-y-6">
          {/* 4 Core Top Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Company Savings */}
            <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span>Total Company Savings</span>
                <PiggyBank className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-gray-900 block">
                  {selectedCurrency === 'BDT' ? '৳' : '$'}{summary.totalCompanySavings.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-gray-500 mt-1 block">
                  Reserve Cash + FDR + DPS Balance
                </span>
              </div>
            </div>

            {/* Card 2: Net Emergency Reserve Cash */}
            <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span>Emergency Reserve Cash</span>
                <Landmark className="h-5 w-5 text-[#100e09]" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-[#100e09] block">
                  {selectedCurrency === 'BDT' ? '৳' : '$'}{summary.netReserveCash.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-gray-500 mt-1 block">
                  Liquid Reserve Balance
                </span>
              </div>
            </div>

            {/* Card 3: FDR Assets */}
            <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span>Fixed Deposit (FDR) Assets</span>
                <Wallet className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-gray-900 block">
                  {selectedCurrency === 'BDT' ? '৳' : '$'}{summary.totalFdrPrincipal.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-gray-500 mt-1 block">
                  +{selectedCurrency === 'BDT' ? '৳' : '$'}{summary.expectedFdrReturns.toLocaleString()} Expected Net Yield
                </span>
              </div>
            </div>

            {/* Card 4: Operating Cash Available */}
            <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span>Available Operating Cash</span>
                <TrendingUp className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-gray-900 block">
                  {selectedCurrency === 'BDT' ? '৳' : '$'}{summary.availableOperatingCash.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-gray-500 mt-1 block">
                  80% Working Cash (After Operating Exp)
                </span>
              </div>
            </div>
          </div>

          {/* Reserve Rule 80/20 & Minimal Financial Safety Target */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 80/20 Rule Banner */}
            <div className="lg:col-span-6 bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="h-5 w-5 text-[#100e09]" />
                  <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">
                    Automatic 20% Reserve Allocation Rule
                  </h3>
                </div>
                <span className="text-[10px] font-bold bg-[#100e09]/10 text-[#100e09] px-2.5 py-1 rounded-md">ACTIVE</span>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Every verified client payment is automatically split: <strong>{summary.reserveSettings?.reserve_percentage || 20}%</strong> is allocated to Emergency Reserve, and <strong>{100 - (summary.reserveSettings?.reserve_percentage || 20)}%</strong> is allocated to operating cash.
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Emergency Reserve</span>
                  <span className="font-extrabold text-[#100e09] text-base">{summary.reserveSettings?.reserve_percentage || 20}%</span>
                  <span className="text-[10px] text-gray-500 block">Restricted Safety Balance</span>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Operating Cash</span>
                  <span className="font-extrabold text-gray-800 text-base">{100 - (summary.reserveSettings?.reserve_percentage || 20)}%</span>
                  <span className="text-[10px] text-gray-500 block">Working Operations</span>
                </div>
              </div>
            </div>

            {/* MINIMAL Financial Safety Target */}
            <div className="lg:col-span-6 bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Financial Safety Target</span>
                </h3>
                <span className="text-xs font-bold text-gray-600">
                  Target: {selectedCurrency === 'BDT' ? '৳' : '$'}{summary.activeTargetAmount.toLocaleString()}
                </span>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-gray-500 font-medium">Coverage Status</span>
                  <span className="font-extrabold text-gray-900 text-sm">
                    {summary.coverageMonths} Months <span className="text-[11px] font-normal text-gray-500">({summary.targetCompletionPct}% achieved)</span>
                  </span>
                </div>

                {/* Sleek Minimal Progress Bar */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#100e09] transition-all duration-500 rounded-full"
                    style={{ width: `${summary.targetCompletionPct}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-gray-500 pt-1 font-medium">
                  <span>Current: {selectedCurrency === 'BDT' ? '৳' : '$'}{summary.totalCompanySavings.toLocaleString()}</span>
                  <span>Target Gap: {selectedCurrency === 'BDT' ? '৳' : '$'}{summary.targetGap.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESERVE LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Company Reserve Double-Entry Ledger</h3>
              <p className="text-xs text-gray-500">Live transaction log of automatic allocations, manual deposits, FDR/DPS transfers, and withdrawals.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchLedger}
                  onChange={(e) => setSearchLedger(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-[#f5f4eb] focus:outline-none w-48"
                />
              </div>
              <button
                onClick={exportLedgerToCsv}
                className="flex items-center space-x-1 bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2">Date</th>
                  <th className="py-3 px-2">Txn ID</th>
                  <th className="py-3 px-2">Entity</th>
                  <th className="py-3 px-2">Transaction Type</th>
                  <th className="py-3 px-2">Source / Ref</th>
                  <th className="py-3 px-2 text-right">Amount</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">
                      <Layers className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs font-semibold">No reserve ledger transactions recorded yet.</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Transactions will appear automatically when client payments are marked paid, or via manual deposits.</p>
                    </td>
                  </tr>
                ) : (
                  ledger
                    .filter(l => (selectedCurrency ? l.currency === selectedCurrency : true))
                    .filter(l => (selectedEntity !== 'all' ? l.entity_id === selectedEntity : true))
                    .filter(l => searchLedger ? JSON.stringify(l).toLowerCase().includes(searchLedger.toLowerCase()) : true)
                    .map(entry => {
                      const isCredit = ['AUTOMATIC_RESERVE_ALLOCATION', 'MANUAL_DEPOSIT', 'TRANSFER_FROM_FDR', 'TRANSFER_FROM_DPS', 'INTEREST_RECEIVED', 'MATURITY_PROCEEDS', 'OPENING_BALANCE'].includes(entry.transaction_type);
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50/60">
                          <td className="py-3 px-2 font-mono text-[11px] text-gray-500">{entry.deposit_date}</td>
                          <td className="py-3 px-2 font-mono font-bold text-gray-800">{entry.id}</td>
                          <td className="py-3 px-2 font-semibold">{entry.entity_id === 'a0000070-0000-4000-8000-000000000001' ? 'app Ltd' : 'Corevow LLC'}</td>
                          <td className="py-3 px-2 font-bold text-gray-800">
                            <span className="block">{entry.transaction_type.replace(/_/g, ' ')}</span>
                            {entry.reason && <span className="text-[10px] font-normal text-gray-400 leading-tight block">{entry.reason}</span>}
                          </td>
                          <td className="py-3 px-2 text-gray-600">{entry.source}</td>
                          <td className={`py-3 px-2 text-right font-extrabold text-sm ${isCredit ? 'text-gray-900' : 'text-rose-700'}`}>
                            {isCredit ? '+' : '-'}{entry.currency === 'BDT' ? '৳' : '$'}{entry.amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="bg-gray-100 text-gray-800 text-[9px] font-extrabold px-2 py-0.5 rounded">
                              {entry.status}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end items-center space-x-2">
                              <button
                                onClick={() => {
                                  setEditingLedger(entry);
                                  setModalType('edit_ledger');
                                }}
                                className="p-1 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                                title="Edit Ledger Entry"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLedger(entry.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                                title="Delete Entry"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FDR PORTFOLIO */}
      {activeTab === 'fdr' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 shadow-xs">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Fixed Deposit Receipts (FDR) Portfolio</h3>
              <p className="text-xs text-gray-500">Create, manage, edit, and track corporate FDR assets and maturity proceeds.</p>
            </div>
            <button
              onClick={openCreateFdrModal}
              className="flex items-center space-x-1.5 bg-[#100e09] text-[#f5f4eb] px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Open New FDR</span>
            </button>
          </div>

          {fdrAccounts.length === 0 ? (
            <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-12 text-center space-y-3">
              <Wallet className="h-10 w-10 text-gray-300 mx-auto" />
              <h4 className="font-extrabold text-sm text-gray-800">No FDR Accounts Created Yet</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No fixed deposit receipts are currently active. Click below to add a new corporate FDR asset.
              </p>
              <button
                onClick={openCreateFdrModal}
                className="inline-flex items-center space-x-1.5 bg-[#100e09] text-[#f5f4eb] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] transition cursor-pointer mt-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create First FDR</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fdrAccounts.map(fdr => (
                <div key={fdr.id} className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{fdr.bank_name} ({fdr.branch_name})</span>
                      <h4 className="font-extrabold text-sm text-gray-900">{fdr.account_title}</h4>
                      <span className="font-mono text-xs text-gray-500 font-semibold block mt-0.5">Ref: {fdr.fdr_reference_number}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-gray-100 text-gray-800 text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase">
                        {fdr.status}
                      </span>
                      <button
                        onClick={() => {
                          setEditingFdr(fdr);
                          setModalType('edit_fdr');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                        title="Edit FDR"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFdr(fdr.id)}
                        className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                        title="Delete FDR"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 font-semibold block">Principal Amount</span>
                      <span className="font-extrabold text-gray-900 text-sm">{fdr.currency === 'BDT' ? '৳' : '$'}{fdr.principal_amount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold block">Interest Rate</span>
                      <span className="font-extrabold text-gray-900 text-sm">{fdr.interest_rate}% p.a.</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold block">Start Date</span>
                      <span className="font-medium text-gray-700">{fdr.start_date}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold block">Maturity Date</span>
                      <span className="font-extrabold text-[#100e09]">{fdr.maturity_date}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Expected Net Maturity:</span>
                      <strong className="font-extrabold text-gray-900">{fdr.currency === 'BDT' ? '৳' : '$'}{fdr.expected_net_maturity_value.toLocaleString()}</strong>
                    </div>
                    {fdr.actual_maturity_value && (
                      <div className="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-1">
                        <span>Actual Realized Proceeds:</span>
                        <span>{fdr.currency === 'BDT' ? '৳' : '$'}{fdr.actual_maturity_value.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {fdr.status === 'ACTIVE' && (
                    <button
                      onClick={() => {
                        setActiveFdrForMaturity(fdr);
                        setMaturityForm({ actual_net_value: fdr.expected_net_maturity_value, action: 'CLOSE', notes: 'Maturity proceeds received.' });
                        setModalType('record_maturity');
                      }}
                      className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Record Maturity / Renewal
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DPS SAVINGS */}
      {activeTab === 'dps' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 shadow-xs">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Deposit Pension Scheme (DPS) Portfolio</h3>
              <p className="text-xs text-gray-500">Manage monthly DPS accounts, pay installments with instant ledger updates, edit or delete schemes.</p>
            </div>
            <button
              onClick={openCreateDpsModal}
              className="flex items-center space-x-1.5 bg-[#100e09] text-[#f5f4eb] px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Start New DPS</span>
            </button>
          </div>

          {dpsAccounts.length === 0 ? (
            <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-12 text-center space-y-3">
              <PiggyBank className="h-10 w-10 text-gray-300 mx-auto" />
              <h4 className="font-extrabold text-sm text-gray-800">No Active DPS Schemes</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No corporate DPS savings accounts are currently created. Click below to start a new DPS scheme.
              </p>
              <button
                onClick={openCreateDpsModal}
                className="inline-flex items-center space-x-1.5 bg-[#100e09] text-[#f5f4eb] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] transition cursor-pointer mt-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create First DPS</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dpsAccounts.map(dps => (
                <div key={dps.id} className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{dps.bank_name}</span>
                      <h4 className="font-extrabold text-sm text-gray-900">{dps.account_title}</h4>
                      <span className="font-mono text-xs text-gray-500 font-semibold block mt-0.5">Acc: {dps.dps_account_number}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-gray-100 text-gray-800 text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase">
                        {dps.status}
                      </span>
                      <button
                        onClick={() => {
                          setEditingDps(dps);
                          setModalType('edit_dps');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                        title="Edit DPS"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDps(dps.id)}
                        className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                        title="Delete DPS"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-500">Installment Progress</span>
                      <span className="font-bold text-gray-900">{dps.paid_installments} of {dps.total_installments} Paid</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#100e09] rounded-full"
                        style={{ width: `${(dps.paid_installments / dps.total_installments) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 font-semibold block">Monthly Amount</span>
                      <span className="font-extrabold text-gray-900">{dps.currency === 'BDT' ? '৳' : '$'}{dps.installment_amount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold block">Total Deposited</span>
                      <span className="font-extrabold text-gray-900">{dps.currency === 'BDT' ? '৳' : '$'}{dps.total_deposited_amount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold block">Next Installment Due</span>
                      <span className="font-extrabold text-[#100e09]">{dps.next_installment_date}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold block">Maturity Date</span>
                      <span className="font-medium text-gray-700">{dps.maturity_date}</span>
                    </div>
                  </div>

                  {/* Installment Schedule */}
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Installment Schedule</span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
                      {dpsInstallments.filter(i => i.dps_account_id === dps.id).map(inst => (
                        <div key={inst.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                          <span className="font-semibold text-gray-700"># Inst {inst.installment_number} ({inst.due_date})</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-900">{dps.currency === 'BDT' ? '৳' : '$'}{inst.amount.toLocaleString()}</span>
                            {inst.status === 'PAID' ? (
                              <span className="bg-gray-200 text-gray-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" /> PAID
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveDpsForPay(inst);
                                  setDpsPayForm({
                                    transaction_reference: `TXN-DPS-${Date.now().toString().slice(-6)}`,
                                    paid_from_account: 'Company Emergency Reserve'
                                  });
                                  setModalType('pay_dps');
                                }}
                                className="bg-[#100e09] text-[#f5f4eb] text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer hover:bg-[#7d1219] shadow-xs"
                              >
                                Pay Now
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WITHDRAWALS */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 shadow-xs">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Reserve Withdrawal Requests & Approvals</h3>
              <p className="text-xs text-gray-500">Formal multi-step approval before releasing emergency reserve funds.</p>
            </div>
            <button
              onClick={openRequestWithdrawalModal}
              className="flex items-center space-x-1.5 bg-[#100e09] text-[#f5f4eb] px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-[#7d1219] transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Submit Withdrawal Request</span>
            </button>
          </div>

          <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">Request Date</th>
                    <th className="py-3 px-2">Requester</th>
                    <th className="py-3 px-2">Purpose / Category</th>
                    <th className="py-3 px-2 text-right">Requested Amount</th>
                    <th className="py-3 px-2 text-center">Status</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {withdrawalRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-400">
                        No withdrawal requests recorded.
                      </td>
                    </tr>
                  ) : (
                    withdrawalRequests.map(wth => (
                      <tr key={wth.id}>
                        <td className="py-3 px-2 font-mono text-gray-500">{wth.request_date}</td>
                        <td className="py-3 px-2 font-bold text-gray-800">{wth.requested_by}</td>
                        <td className="py-3 px-2">
                          <span className="font-bold text-gray-900 block">{wth.purpose}</span>
                          <span className="text-[10px] text-gray-400 block">{wth.detailed_reason}</span>
                        </td>
                        <td className="py-3 px-2 text-right font-extrabold text-rose-700 text-sm">
                          {wth.currency === 'BDT' ? '৳' : '$'}{wth.requested_amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase ${
                            wth.status === 'APPROVED' ? 'bg-gray-100 text-gray-900 font-bold' :
                            wth.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {wth.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {wth.status === 'SUBMITTED' && currentUser?.role_name === 'Super Admin' && (
                            <button
                              onClick={() => {
                                setReviewWithdrawalItem(wth);
                                setModalType('review_withdrawal');
                              }}
                              className="bg-[#100e09] text-[#f5f4eb] px-2.5 py-1 rounded text-xs font-bold cursor-pointer hover:bg-[#7d1219]"
                            >
                              Review & Decide
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: POLICY SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Configurable Reserve Policy</h3>
                <p className="text-xs text-gray-500">Super Admin configuration for default payment allocation percentage and target safety buffers.</p>
              </div>
              <button
                onClick={handleUpdateSettings}
                disabled={formSaving}
                className="bg-[#100e09] text-[#f5f4eb] px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-[#7d1219]"
              >
                Save Policy Updates
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Reserve Allocation Percentage (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settingsForm.reserve_percentage}
                  onChange={(e) => setSettingsForm({ ...settingsForm, reserve_percentage: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-gray-200 p-2.5 font-extrabold text-gray-900 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Fixed Target (BDT ৳)</label>
                <input
                  type="number"
                  value={settingsForm.target_fixed_bdt}
                  onChange={(e) => setSettingsForm({ ...settingsForm, target_fixed_bdt: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-gray-200 p-2.5 font-bold text-gray-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Fixed Target (USD $)</label>
                <input
                  type="number"
                  value={settingsForm.target_fixed_usd}
                  onChange={(e) => setSettingsForm({ ...settingsForm, target_fixed_usd: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-gray-200 p-2.5 font-bold text-gray-900"
                />
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <label className="font-bold text-gray-700 block">Reason for Policy Change</label>
              <input
                type="text"
                value={settingsForm.reason}
                onChange={(e) => setSettingsForm({ ...settingsForm, reason: e.target.value })}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: AUDIT LOGS */}
      {activeTab === 'audit_logs' && (
        <div className="bg-[#f5f4eb] border border-gray-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Immutable Financial Audit Logs</h3>
          <div className="space-y-2 text-xs">
            {auditLogs.length === 0 ? (
              <p className="text-center py-6 text-gray-400">No audit logs recorded yet.</p>
            ) : (
              auditLogs.map(a => (
                <div key={a.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-bold text-gray-800 block">{a.action} ({a.module})</span>
                    <span className="text-[10px] font-mono text-gray-500 block">ID: {a.record_id}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-700 block">{a.user_role}</span>
                    <span className="text-[10px] text-gray-400 block">{a.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: Manual Deposit */}
      {modalType === 'manual_deposit' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f4eb] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase">Manual Reserve Deposit</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Entity</label>
                <select
                  value={manualDepositForm.entity_id}
                  onChange={(e) => setManualDepositForm({ ...manualDepositForm, entity_id: e.target.value })}
                  className="w-full border rounded-xl p-2 font-bold"
                >
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>{e.legal_name} ({e.entity_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Currency</label>
                <select
                  value={manualDepositForm.currency}
                  onChange={(e) => setManualDepositForm({ ...manualDepositForm, currency: e.target.value as any })}
                  className="w-full border rounded-xl p-2 font-bold"
                >
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Amount</label>
                <input
                  type="number"
                  value={manualDepositForm.amount}
                  onChange={(e) => setManualDepositForm({ ...manualDepositForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-xl p-2 font-extrabold text-gray-900"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Reason / Description</label>
                <input
                  type="text"
                  value={manualDepositForm.reason}
                  onChange={(e) => setManualDepositForm({ ...manualDepositForm, reason: e.target.value })}
                  className="w-full border rounded-xl p-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
              <button onClick={handleCreateManualDeposit} disabled={formSaving} className="px-4 py-2 bg-[#100e09] text-[#f5f4eb] rounded-xl text-xs font-bold">Deposit Now</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Ledger Entry */}
      {modalType === 'edit_ledger' && editingLedger && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f4eb] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase">Edit Reserve Ledger Entry</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Amount</label>
                <input
                  type="number"
                  value={editingLedger.amount}
                  onChange={(e) => setEditingLedger({ ...editingLedger, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-xl p-2 font-extrabold text-gray-900"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Reason / Notes</label>
                <input
                  type="text"
                  value={editingLedger.reason || ''}
                  onChange={(e) => setEditingLedger({ ...editingLedger, reason: e.target.value })}
                  className="w-full border rounded-xl p-2 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
              <button onClick={handleUpdateLedger} disabled={formSaving} className="px-4 py-2 bg-[#100e09] text-[#f5f4eb] rounded-xl text-xs font-bold">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create FDR */}
      {modalType === 'create_fdr' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f4eb] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase">Open New Corporate FDR</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="font-semibold text-gray-600 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={fdrForm.bank_name}
                  onChange={(e) => setFdrForm({ ...fdrForm, bank_name: e.target.value })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Principal Amount</label>
                <input
                  type="number"
                  value={fdrForm.principal_amount}
                  onChange={(e) => setFdrForm({ ...fdrForm, principal_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-xl p-2 font-extrabold text-gray-900"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Interest Rate (% p.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={fdrForm.interest_rate}
                  onChange={(e) => setFdrForm({ ...fdrForm, interest_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Tenure (Months)</label>
                <input
                  type="number"
                  value={fdrForm.tenure_months}
                  onChange={(e) => setFdrForm({ ...fdrForm, tenure_months: parseInt(e.target.value) || 12 })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Currency</label>
                <select
                  value={fdrForm.currency}
                  onChange={(e) => setFdrForm({ ...fdrForm, currency: e.target.value as any })}
                  className="w-full border rounded-xl p-2 font-bold"
                >
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
              <button onClick={handleCreateFdr} disabled={formSaving} className="px-4 py-2 bg-[#100e09] text-[#f5f4eb] rounded-xl text-xs font-bold">Create FDR Asset</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit FDR */}
      {modalType === 'edit_fdr' && editingFdr && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f4eb] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase">Edit FDR Account Details</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="font-semibold text-gray-600 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={editingFdr.bank_name}
                  onChange={(e) => setEditingFdr({ ...editingFdr, bank_name: e.target.value })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Principal Amount</label>
                <input
                  type="number"
                  value={editingFdr.principal_amount}
                  onChange={(e) => setEditingFdr({ ...editingFdr, principal_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-xl p-2 font-extrabold text-gray-900"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingFdr.interest_rate}
                  onChange={(e) => setEditingFdr({ ...editingFdr, interest_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
              <button onClick={handleUpdateFdr} disabled={formSaving} className="px-4 py-2 bg-[#100e09] text-[#f5f4eb] rounded-xl text-xs font-bold">Save FDR Updates</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create DPS */}
      {modalType === 'create_dps' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f4eb] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase">Start New Corporate DPS</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="font-semibold text-gray-600 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={dpsForm.bank_name}
                  onChange={(e) => setDpsForm({ ...dpsForm, bank_name: e.target.value })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Monthly Installment</label>
                <input
                  type="number"
                  value={dpsForm.installment_amount}
                  onChange={(e) => setDpsForm({ ...dpsForm, installment_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-xl p-2 font-extrabold text-gray-900"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-600 block mb-1">Total Installments (Months)</label>
                <input
                  type="number"
                  value={dpsForm.total_installments}
                  onChange={(e) => setDpsForm({ ...dpsForm, total_installments: parseInt(e.target.value) || 36 })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
              <button onClick={handleCreateDps} disabled={formSaving} className="px-4 py-2 bg-[#100e09] text-[#f5f4eb] rounded-xl text-xs font-bold">Start DPS Scheme</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit DPS */}
      {modalType === 'edit_dps' && editingDps && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f4eb] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase">Edit DPS Account Details</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="font-semibold text-gray-600 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={editingDps.bank_name}
                  onChange={(e) => setEditingDps({ ...editingDps, bank_name: e.target.value })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Monthly Installment Amount</label>
                <input
                  type="number"
                  value={editingDps.installment_amount}
                  onChange={(e) => setEditingDps({ ...editingDps, installment_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-xl p-2 font-extrabold text-gray-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
              <button onClick={handleUpdateDps} disabled={formSaving} className="px-4 py-2 bg-[#100e09] text-[#f5f4eb] rounded-xl text-xs font-bold">Save DPS Updates</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pay DPS Installment */}
      {modalType === 'pay_dps' && activeDpsForPay && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f4eb] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase">Pay DPS Installment</h3>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1">
              <p><strong>Installment Number:</strong> #{activeDpsForPay.installment_number}</p>
              <p><strong>Due Date:</strong> {activeDpsForPay.due_date}</p>
              <p><strong>Amount:</strong> <strong className="text-gray-900 font-extrabold">৳{activeDpsForPay.amount.toLocaleString()}</strong></p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Transaction Reference / Receipt No</label>
                <input
                  type="text"
                  value={dpsPayForm.transaction_reference}
                  onChange={(e) => setDpsPayForm({ ...dpsPayForm, transaction_reference: e.target.value })}
                  className="w-full border rounded-xl p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 block mb-1">Payment Account Source</label>
                <input
                  type="text"
                  value={dpsPayForm.paid_from_account}
                  onChange={(e) => setDpsPayForm({ ...dpsPayForm, paid_from_account: e.target.value })}
                  className="w-full border rounded-xl p-2 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
              <button onClick={handleDpsPaySubmit} disabled={formSaving} className="px-4 py-2 bg-[#100e09] text-[#f5f4eb] rounded-xl text-xs font-bold">Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Review Withdrawal */}
      {modalType === 'review_withdrawal' && reviewWithdrawalItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#f5f4eb] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase">Review Reserve Withdrawal</h3>
            <div className="p-3 bg-gray-50 border rounded-xl text-xs space-y-1">
              <p><strong>Requester:</strong> {reviewWithdrawalItem.requested_by}</p>
              <p><strong>Purpose:</strong> {reviewWithdrawalItem.purpose}</p>
              <p><strong>Amount:</strong> <strong className="text-rose-700">{reviewWithdrawalItem.currency} {reviewWithdrawalItem.requested_amount.toLocaleString()}</strong></p>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-gray-700 block">Approval Comment</label>
              <textarea
                value={withdrawalComment}
                onChange={(e) => setWithdrawalComment(e.target.value)}
                placeholder="Enter approval note or rejection reason..."
                className="w-full border rounded-xl p-2.5 text-xs h-20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => handleReviewWithdrawal('REJECTED')} disabled={formSaving} className="px-4 py-2 bg-rose-600 text-[#f5f4eb] rounded-xl text-xs font-bold">Reject</button>
              <button onClick={() => handleReviewWithdrawal('APPROVED')} disabled={formSaving} className="px-4 py-2 bg-emerald-600 text-[#f5f4eb] rounded-xl text-xs font-bold">Approve & Release</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
