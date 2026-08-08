'use client';

import { useState, useEffect } from 'react';
import { db, BusinessEntity, Profile } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Building2, Hash, RefreshCw, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface DocumentCounter {
  id: string;
  entity_id: string;
  document_type: string;
  period_key: string;
  prefix: string;
  last_number: number;
  padding: number;
  updated_at: string;
}

export default function InvoiceNumberingSettingsPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [counters, setCounters] = useState<DocumentCounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const u = await db.getCurrentUser();
        setCurrentUser(u);
        const ents = await db.getEntities();
        setEntities(ents);

        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from('document_number_counters').select('*');
          if (data) setCounters(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const isAuthorized = currentUser?.role_name === 'Super Admin' || currentUser?.role_name === 'Admin';

  const getEntityCounter = (entityId: string) => {
    const year = new Date().getFullYear().toString();
    return counters.find(c => c.entity_id === entityId && c.period_key === year);
  };

  const handleUpdatePrefix = async (entity: BusinessEntity, newPrefix: string) => {
    if (!isAuthorized) return;
    setSaving(true);
    setNotification(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('business_entities')
          .update({ invoice_prefix: newPrefix, updated_at: new Date().toISOString() })
          .eq('id', entity.id);

        if (error) throw new Error(error.message);

        // Also update counter prefix if exists
        await supabase
          .from('document_number_counters')
          .update({ prefix: newPrefix, updated_at: new Date().toISOString() })
          .eq('entity_id', entity.id);
      }

      setEntities(prev => prev.map(e => e.id === entity.id ? { ...e, invoice_prefix: newPrefix } : e));
      setNotification({ type: 'success', message: `Invoice prefix updated to "${newPrefix}" for ${entity.legal_name}.` });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to update numbering settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">Invoice Numbering Rules</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Configurable database document counters and serial format rules per legal entity
        </p>
      </div>

      {notification && (
        <div className={`p-4 rounded-2xl flex items-center space-x-3 text-xs sm:text-sm font-semibold text-[#f5f4eb] ${
          notification.type === 'success' ? 'bg-emerald-900' : 'bg-rose-900'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {!isAuthorized && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Only Super Admins and Admins can modify invoice serial counter configurations.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {entities.map(entity => {
          const counter = getEntityCounter(entity.id);
          const lastNum = counter?.last_number || 0;
          const nextNum = lastNum + 1;
          const prefix = entity.invoice_prefix || entity.entity_code || 'INV';
          const padding = counter?.padding || 4;
          const previewNum = `${prefix}-INV-${currentYear}-${String(nextNum).padStart(padding, '0')}`;

          return (
            <div key={entity.id} className="bg-[#f5f4eb] border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-6 w-6 text-[#100e09]" />
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900">{entity.legal_name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                      {entity.entity_code} • {entity.entity_code === 'CLTD' ? 'BDT (৳)' : 'USD ($)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Number Format Preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-1.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Next Issued Serial Preview</span>
                <p className="font-mono text-base font-extrabold text-[#100e09]">{previewNum}</p>
                <p className="text-[11px] text-gray-500">Atomic database counter • Calendar Year reset</p>
              </div>

              {/* Counter Statistics */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Current Period</span>
                  <span className="font-bold text-gray-800">{currentYear}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Last Issued</span>
                  <span className="font-mono font-extrabold text-gray-900">{lastNum}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Next Expected</span>
                  <span className="font-mono font-extrabold text-emerald-700">{nextNum}</span>
                </div>
              </div>

              {/* Prefix Input */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-gray-700 block">Entity Invoice Prefix</label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                      <Hash className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      defaultValue={prefix}
                      disabled={!isAuthorized || saving}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== prefix) {
                          handleUpdatePrefix(entity, e.target.value.trim().toUpperCase());
                        }
                      }}
                      className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-xs font-mono font-bold uppercase focus:border-[#100e09] focus:outline-none disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
