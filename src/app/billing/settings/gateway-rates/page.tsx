'use client';

import { useState, useEffect } from 'react';
import { db, GatewayRates, CustomGateway, Profile } from '@/lib/db';
import { Plus, Trash2, Save, Settings2, Zap, RefreshCw, Info } from 'lucide-react';
import NotificationModal from '@/components/NotificationModal';

const PALETTE_COLORS = [
  'bg-pink-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500',
  'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500',
  'bg-purple-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-red-500',
];

const BUILT_IN_GATEWAYS = [
  { key: 'bkash', label: 'bKash Mobile Wallet', currency: 'BDT', color: 'bg-pink-500', description: 'Bangladesh MFS — Merchant charge' },
  { key: 'nagad', label: 'Nagad Mobile Wallet', currency: 'BDT', color: 'bg-orange-500', description: 'Bangladesh MFS — Merchant charge' },
  { key: 'card', label: 'Visa / Mastercard', currency: 'Both', color: 'bg-blue-600', description: 'Debit & Credit card swipe fee' },
  { key: 'amex', label: 'American Express', currency: 'Both', color: 'bg-indigo-600', description: 'AMEX network premium fee' },
  { key: 'stripe', label: 'Stripe', currency: 'USD', color: 'bg-[#635BFF]', description: 'Stripe platform processing charge' },
  { key: 'payoneer', label: 'Payoneer', currency: 'USD', color: 'bg-sky-500', description: 'Payoneer international transfer' },
  { key: 'wise', label: 'Wise (TransferWise)', currency: 'USD', color: 'bg-teal-500', description: 'Wise conversion + transfer fee' },
] as const;

export default function GatewayRatesSettingsPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [rates, setRates] = useState<GatewayRates>({
    bkash: 1.85, nagad: 1.50, card: 2.50, amex: 3.50,
    stripe: 2.90, payoneer: 2.00, wise: 0.50, customGateways: []
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // New custom gateway form
  const [newGatewayName, setNewGatewayName] = useState('');
  const [newGatewayRate, setNewGatewayRate] = useState<number>(0);
  const [newGatewayCurrency, setNewGatewayCurrency] = useState<'BDT' | 'USD' | 'Both'>('Both');
  const [newGatewayColor, setNewGatewayColor] = useState(PALETTE_COLORS[0]);
  const [addingCustom, setAddingCustom] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModalState({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    async function load() {
      try {
        const u = await db.getCurrentUser();
        setCurrentUser(u);
        const r = await db.getGatewayRates();
        setRates(r);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isSuperAdmin = currentUser?.role_name === 'Super Admin';
  const isFinance = currentUser?.role_name === 'Finance Admin';
  const canEdit = isSuperAdmin || isFinance;

  const handleBuiltInChange = (key: keyof GatewayRates, val: string) => {
    const num = parseFloat(val) || 0;
    setRates(prev => ({ ...prev, [key]: num }));
  };

  const handleSave = async () => {
    if (!canEdit) {
      showModal('Access Restricted', 'Only Super Admins and Finance Admins can modify gateway rates.', 'error');
      return;
    }
    setSaving(true);
    try {
      await db.setGatewayRates(rates);
      showModal('Rates Saved', 'All gateway cutoff rates have been updated successfully.', 'success');
    } catch (err: any) {
      showModal('Save Failed', err.message || 'Failed to save rates.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomGateway = () => {
    if (!newGatewayName.trim()) {
      showModal('Name Required', 'Please enter a gateway name.', 'error');
      return;
    }
    if (newGatewayRate < 0 || newGatewayRate > 100) {
      showModal('Invalid Rate', 'Fee rate must be between 0% and 100%.', 'error');
      return;
    }
    const newCustom: CustomGateway = {
      id: `custom-${Date.now()}`,
      name: newGatewayName.trim(),
      rate: newGatewayRate,
      currency: newGatewayCurrency,
      color: newGatewayColor,
    };
    setRates(prev => ({
      ...prev,
      customGateways: [...(prev.customGateways || []), newCustom]
    }));
    setNewGatewayName('');
    setNewGatewayRate(0);
    setNewGatewayCurrency('Both');
    setNewGatewayColor(PALETTE_COLORS[0]);
    setAddingCustom(false);
  };

  const handleDeleteCustomGateway = (id: string) => {
    setRates(prev => ({
      ...prev,
      customGateways: (prev.customGateways || []).filter(g => g.id !== id)
    }));
  };

  const handleCustomRateChange = (id: string, val: string) => {
    const num = parseFloat(val) || 0;
    setRates(prev => ({
      ...prev,
      customGateways: (prev.customGateways || []).map(g =>
        g.id === id ? { ...g, rate: num } : g
      )
    }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center space-x-3">
            <Settings2 className="h-7 w-7 text-[#100e09]" />
            <span>Platform / Gateway Cutoff Rates</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Define per-gateway cutoff fee rates (%) for auto-calculating transaction deductions
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 rounded-xl bg-[#100e09] px-5 py-2.5 text-sm font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md cursor-pointer transition disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save All Rates'}</span>
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center space-x-2 text-sm text-amber-800">
          <Info className="h-4 w-4 text-amber-600 shrink-0" />
          <span>You are in read-only mode. Only Super Admins and Finance Admins can modify gateway rates.</span>
        </div>
      )}

      {/* Built-in Gateways Grid */}
      <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 space-y-5">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base flex items-center space-x-2">
              <Zap className="h-4 w-4 text-[#100e09]" />
              <span>Built-in Payment Gateways</span>
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Standard payment channel cutoff rates</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {BUILT_IN_GATEWAYS.map((gw) => {
            const rateVal = rates[gw.key as keyof GatewayRates] as number;
            return (
              <div
                key={gw.key}
                className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 space-y-3"
              >
                <div className="flex items-center space-x-2.5">
                  <span className={`w-3 h-3 rounded-full ${gw.color} shrink-0`} />
                  <div className="min-w-0">
                    <span className="font-bold text-sm text-gray-800 block truncate">{gw.label}</span>
                    <span className="text-[10px] text-gray-400">{gw.description}</span>
                  </div>
                  <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                    {gw.currency}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      disabled={!canEdit}
                      value={rateVal}
                      onChange={(e) => handleBuiltInChange(gw.key as keyof GatewayRates, e.target.value)}
                      className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 pl-3 pr-8 text-sm font-bold text-gray-800 focus:border-[#100e09] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block">e.g. on ৳10,000</span>
                    <span className="text-xs font-bold text-amber-700">
                      -{((rateVal / 100) * 10000).toFixed(0)} cut
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Gateways */}
      <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6 space-y-5">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 text-emerald-600" />
              <span>Custom Gateways</span>
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Add any new or non-standard payment platform your team uses</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setAddingCustom(true)}
              className="flex items-center space-x-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Gateway</span>
            </button>
          )}
        </div>

        {/* Add custom gateway form */}
        {addingCustom && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">New Custom Gateway</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Gateway Name *</label>
                <input
                  type="text"
                  value={newGatewayName}
                  onChange={(e) => setNewGatewayName(e.target.value)}
                  placeholder="e.g. Binance Pay, FasaPay, Razorpay..."
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-gray-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cutoff Rate *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newGatewayRate}
                    onChange={(e) => setNewGatewayRate(parseFloat(e.target.value) || 0)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 pl-3 pr-8 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Currency Applicability</label>
                <select
                  value={newGatewayCurrency}
                  onChange={(e) => setNewGatewayCurrency(e.target.value as 'BDT' | 'USD' | 'Both')}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2 px-3 text-xs text-gray-800 focus:outline-none cursor-pointer"
                >
                  <option value="BDT">BDT only (Bangladesh)</option>
                  <option value="USD">USD only (International)</option>
                  <option value="Both">Both BDT & USD</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Chart Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE_COLORS.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewGatewayColor(col)}
                      className={`w-5 h-5 rounded-full ${col} cursor-pointer transition ${newGatewayColor === col ? 'ring-2 ring-offset-1 ring-gray-600 scale-110' : 'hover:scale-110'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setAddingCustom(false)}
                className="rounded-lg border border-gray-200 bg-[#f5f4eb] px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomGateway}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-[#f5f4eb] hover:bg-emerald-700 cursor-pointer shadow-sm"
              >
                Add Gateway
              </button>
            </div>
          </div>
        )}

        {/* Custom gateway list */}
        {(rates.customGateways || []).length === 0 && !addingCustom ? (
          <div className="py-8 text-center space-y-2">
            <Settings2 className="h-8 w-8 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-400">No custom gateways yet</p>
            <p className="text-[11px] text-gray-350">
              Click "Add Gateway" to register a new payment platform with a custom cutoff fee rate.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {(rates.customGateways || []).map((cg) => (
              <div key={cg.id} className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <span className={`w-3 h-3 rounded-full ${cg.color} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-sm text-gray-800 block truncate">{cg.name}</span>
                    <span className="text-[10px] text-gray-400">Custom platform</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                    {cg.currency}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteCustomGateway(cg.id)}
                      className="text-red-400 hover:text-red-600 cursor-pointer transition shrink-0 ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      disabled={!canEdit}
                      value={cg.rate}
                      onChange={(e) => handleCustomRateChange(cg.id, e.target.value)}
                      className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-1.5 pl-3 pr-8 text-sm font-bold text-gray-800 focus:border-[#100e09] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block">on ৳10,000</span>
                    <span className="text-xs font-bold text-amber-700">
                      -{((cg.rate / 100) * 10000).toFixed(0)} cut
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Footer reminder */}
      {canEdit && (
        <div className="rounded-xl bg-[#100e09]/5 border border-[#100e09]/15 p-4 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            <strong>Remember:</strong> Click <strong>"Save All Rates"</strong> to persist your changes. Rates are used across Payments recording and the Platform Fee Monitor.
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-4 flex items-center space-x-1.5 rounded-lg bg-[#100e09] px-4 py-2 text-xs font-bold text-[#f5f4eb] hover:bg-[#100e09]/90 cursor-pointer transition disabled:opacity-60 shrink-0"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Save Now'}</span>
          </button>
        </div>
      )}

      <NotificationModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </div>
  );
}
