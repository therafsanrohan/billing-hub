/**
 * Comprehensive Clean Up of Demo & Test Records from Supabase PostgreSQL
 */

import { createClient } from '@supabase/supabase-js';

async function cleanupAllDemoData() {
  console.log('=== RUNNING COMPREHENSIVE SUPABASE DEMO & TEST DATA CLEANUP ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nefnjnngviaywjteduhm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_WwFaeFNaO5DRUGYa3FXWDw_SnsvbW9V';

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Delete test invoices (ACCEPT-%, TEST-%, PO-2026-ACCEPTANCE, etc.)
  const { data: deletedInvoices, error: invErr } = await supabase
    .from('invoices')
    .delete()
    .or('invoice_number.ilike.ACCEPT-%,invoice_number.ilike.TEST-%,project_name.ilike.%Acceptance%,project_name.ilike.%Migration%,po_number.ilike.%ACCEPTANCE%')
    .select('id, invoice_number, project_name');

  if (invErr) {
    console.error('Error deleting test invoices:', invErr.message);
  } else {
    console.log(`✓ Deleted ${deletedInvoices?.length || 0} test invoices from 'invoices' table.`);
    deletedInvoices?.forEach(i => console.log(`   - ${i.invoice_number || i.project_name} (${i.id})`));
  }

  // 2. Delete test clients (Preview Acceptance Corp %, Test %, etc.)
  const { data: deletedClients, error: clientErr } = await supabase
    .from('billing_clients')
    .delete()
    .or('company_name.ilike.Preview Acceptance Corp%,billing_email.ilike.%@acceptance-corp.com,company_name.ilike.Test %')
    .select('id, company_name');

  if (clientErr) {
    console.error('Error deleting test clients:', clientErr.message);
  } else {
    console.log(`✓ Deleted ${deletedClients?.length || 0} test clients from 'billing_clients' table.`);
    deletedClients?.forEach(c => console.log(`   - ${c.company_name} (${c.id})`));
  }

  // 3. Delete test bank accounts (Acceptance Bank, Test Persistent Bank, etc.)
  const { data: deletedBanks, error: bankErr } = await supabase
    .from('entity_bank_accounts')
    .delete()
    .or('bank_name.ilike.%Acceptance Bank%,bank_name.ilike.%Test Persistent Bank%')
    .select('id, bank_name');

  if (bankErr) {
    console.error('Error deleting test bank accounts:', bankErr.message);
  } else {
    console.log(`✓ Deleted ${deletedBanks?.length || 0} test bank accounts from 'entity_bank_accounts' table.`);
    deletedBanks?.forEach(b => console.log(`   - ${b.bank_name} (${b.id})`));
  }

  console.log('\n=== COMPREHENSIVE CLEANUP COMPLETE ===');
}

cleanupAllDemoData().catch(err => {
  console.error('❌ Comprehensive cleanup script error:', err);
  process.exit(1);
});
