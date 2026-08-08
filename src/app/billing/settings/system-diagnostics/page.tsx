'use client';

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { handleDatabaseError, FriendlyDatabaseError } from '@/lib/utils/db-error-handler';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw, Shield, Server, Database, Lock } from 'lucide-react';
import Link from 'next/link';

interface DiagnosticResult {
  name: string;
  category: 'Config' | 'Auth' | 'Database' | 'Tables';
  status: 'Passed' | 'Failed' | 'Warning';
  message: string;
  traceId?: string;
}

export default function SystemDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [envInfo, setEnvInfo] = useState<{ isProduction: boolean; appUrl: string }>({ isProduction: false, appUrl: '' });

  const runDiagnostics = async () => {
    setLoading(true);
    const checks: DiagnosticResult[] = [];
    setEnvInfo({
      isProduction: process.env.NODE_ENV === 'production',
      appUrl: typeof window !== 'undefined' ? window.location.origin : '',
    });

    // 1. Supabase Config Check
    if (isSupabaseConfigured && supabase) {
      checks.push({
        name: 'Supabase Environment Configuration',
        category: 'Config',
        status: 'Passed',
        message: 'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are active.',
      });
    } else {
      checks.push({
        name: 'Supabase Environment Configuration',
        category: 'Config',
        status: 'Failed',
        message: 'Cloud database configuration environment variables are missing.',
      });
    }

    if (supabase) {
      // 2. Auth API Reachability Check
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          const handled = handleDatabaseError(sessionErr, 'diagnostics_auth');
          checks.push({
            name: 'Supabase Auth Service Reachability',
            category: 'Auth',
            status: 'Failed',
            message: handled.userMessage,
            traceId: handled.traceId,
          });
        } else {
          checks.push({
            name: 'Supabase Auth Service Reachability',
            category: 'Auth',
            status: 'Passed',
            message: sessionData.session ? `Active user session verified (${sessionData.session.user.email}).` : 'Auth service reachable. No active user session.',
          });
        }
      } catch (err: any) {
        const handled = handleDatabaseError(err, 'diagnostics_auth_catch');
        checks.push({
          name: 'Supabase Auth Service Reachability',
          category: 'Auth',
          status: 'Failed',
          message: handled.userMessage,
          traceId: handled.traceId,
        });
      }

      // 3. Public Business Entities Table Reachability
      try {
        const { data, error } = await supabase.from('business_entities').select('id, entity_code').limit(2);
        if (error) {
          const handled = handleDatabaseError(error, 'diagnostics_entities');
          checks.push({
            name: 'Business Entities Data API',
            category: 'Database',
            status: 'Failed',
            message: handled.userMessage,
            traceId: handled.traceId,
          });
        } else {
          checks.push({
            name: 'Business Entities Data API',
            category: 'Database',
            status: 'Passed',
            message: `Reachable. Found ${data?.length || 0} canonical legal entities (CLTD/CLLC).`,
          });
        }
      } catch (err: any) {
        const handled = handleDatabaseError(err, 'diagnostics_entities_catch');
        checks.push({
          name: 'Business Entities Data API',
          category: 'Database',
          status: 'Failed',
          message: handled.userMessage,
          traceId: handled.traceId,
        });
      }

      // 4. Invoices Table Reachability
      try {
        const { error } = await supabase.from('invoices').select('id').limit(1);
        if (error) {
          const handled = handleDatabaseError(error, 'diagnostics_invoices');
          checks.push({
            name: 'Invoices Table Access',
            category: 'Tables',
            status: 'Failed',
            message: handled.userMessage,
            traceId: handled.traceId,
          });
        } else {
          checks.push({
            name: 'Invoices Table Access',
            category: 'Tables',
            status: 'Passed',
            message: 'Invoices table query executed without error.',
          });
        }
      } catch (err: any) {
        const handled = handleDatabaseError(err, 'diagnostics_invoices_catch');
        checks.push({
          name: 'Invoices Table Access',
          category: 'Tables',
          status: 'Failed',
          message: handled.userMessage,
          traceId: handled.traceId,
        });
      }

      // 5. Clients Table Reachability
      try {
        const { error } = await supabase.from('clients').select('id').limit(1);
        if (error) {
          const handled = handleDatabaseError(error, 'diagnostics_clients');
          checks.push({
            name: 'Clients Table Access',
            category: 'Tables',
            status: 'Failed',
            message: handled.userMessage,
            traceId: handled.traceId,
          });
        } else {
          checks.push({
            name: 'Clients Table Access',
            category: 'Tables',
            status: 'Passed',
            message: 'Clients table query executed without error.',
          });
        }
      } catch (err: any) {
        const handled = handleDatabaseError(err, 'diagnostics_clients_catch');
        checks.push({
          name: 'Clients Table Access',
          category: 'Tables',
          status: 'Failed',
          message: handled.userMessage,
          traceId: handled.traceId,
        });
      }

      // 6. Server Health Check Endpoint Test
      try {
        const res = await fetch('/api/health/supabase');
        if (res.ok) {
          const healthJson = await res.json();
          checks.push({
            name: 'Server-Side Health API (/api/health/supabase)',
            category: 'Config',
            status: healthJson.reachable ? 'Passed' : 'Warning',
            message: `Server endpoint reachable. DB: ${healthJson.databaseReachable ? 'OK' : 'Off'}, Auth: ${healthJson.authReachable ? 'OK' : 'Off'}.`,
          });
        } else {
          checks.push({
            name: 'Server-Side Health API (/api/health/supabase)',
            category: 'Config',
            status: 'Warning',
            message: `Health endpoint returned status ${res.status}.`,
          });
        }
      } catch (err: any) {
        checks.push({
          name: 'Server-Side Health API (/api/health/supabase)',
          category: 'Config',
          status: 'Warning',
          message: 'Could not query local health API endpoint.',
        });
      }
    }

    setResults(checks);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const totalPassed = results.filter(r => r.status === 'Passed').length;
  const totalFailed = results.filter(r => r.status === 'Failed').length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#100e09]" />
            Cloud Database System Diagnostics
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Safe live connectivity and environment verification for Corevow Billing Hub.
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center space-x-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-xs font-semibold text-[#f5f4eb] hover:bg-gray-800 disabled:opacity-50 cursor-pointer transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Re-run Diagnostics</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-[#f5f4eb] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Status</span>
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-lg font-bold text-gray-900">
            {totalFailed === 0 ? 'Healthy Cloud Connection' : `${totalFailed} Issue(s) Detected`}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-[#f5f4eb] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Passed Checks</span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{totalPassed} / {results.length}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-[#f5f4eb] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Environment</span>
            <Server className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-sm font-bold text-gray-800">
            {envInfo.isProduction ? 'Production Deployment' : 'Development / Preview'}
          </p>
          <p className="text-[10px] text-gray-400 truncate">{envInfo.appUrl}</p>
        </div>
      </div>

      {/* Diagnostic Checklist */}
      <div className="rounded-xl border border-gray-200 bg-[#f5f4eb] shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Diagnostic Inspection Log</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-500 flex justify-center items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#100e09]" />
              <span>Executing live network and database probes...</span>
            </div>
          ) : (
            results.map((r, idx) => (
              <div key={idx} className="p-4 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {r.status === 'Passed' && <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                    {r.status === 'Warning' && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                    {r.status === 'Failed' && <XCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />}
                    <span className="text-xs font-bold text-gray-900">{r.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">{r.category}</span>
                  </div>
                  <p className="text-xs text-gray-600 pl-6 leading-relaxed">{r.message}</p>
                  {r.traceId && (
                    <p className="text-[10px] font-mono text-gray-400 pl-6">Trace ID: {r.traceId}</p>
                  )}
                </div>
                <span className={`text-xs font-bold ${r.status === 'Passed' ? 'text-emerald-600' : r.status === 'Warning' ? 'text-amber-600' : 'text-rose-600'}`}>
                  {r.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
