/**
 * Preview Acceptance Test & Real Supabase Row Inspector
 * Simulates complete E2E Cloud SaaS workflows and outputs exact database rows created in Supabase PostgreSQL.
 */

import { db } from '../src/lib/db';
import { supabase } from '../src/lib/supabase';
import { getPublicSupabaseConfig } from '../src/lib/supabase/config';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function runPreviewAcceptanceTest() {
  console.log('=== STARTING PREVIEW ACCEPTANCE TEST & SUPABASE ROW INSPECTION ===\n');

  // 1. Verify Configuration & Cloud Database Reachability
  const config = getPublicSupabaseConfig();
  assert(!!config.supabaseUrl && !!config.publishableKey, '1. Supabase public config verified');

  if (!supabase) {
    throw new Error('Supabase client failed to initialize');
  }

  // 2. Acceptance Step 1: Create a Test Client in Supabase
  const testClientPayload = {
    client_type: 'company' as const,
    company_name: 'Preview Acceptance Corp ' + Date.now().toString(36),
    contact_person: 'Sarah Jenkins',
    billing_email: `sarah.${Date.now()}@acceptance-corp.com`,
    additional_emails: [],
    phone: '+1 555 019 2834',
    billing_address: '100 Innovation Way, Suite 400',
    city: 'Tech Park',
    country: 'United States',
    tax_number: 'US-EIN-99281726',
    preferred_currency: 'USD' as const,
    default_payment_terms: '30 Days' as const,
    account_manager_id: null,
    internal_note: 'Created during Vercel Preview Acceptance Test'
  };

  const createdClient = await db.createClient(testClientPayload);
  assert(!!createdClient.id, `2. Client created successfully in Supabase (ID: ${createdClient.id})`);

  // Direct Supabase Query Verification for Client
  const { data: dbClient, error: clientErr } = await supabase
    .from('billing_clients')
    .select('*')
    .eq('id', createdClient.id)
    .single();

  assert(!clientErr && !!dbClient, '3. Directly queried created client from Supabase PostgreSQL table billing_clients');

  // 3. Acceptance Step 2: Create a Real Bank Account with Routing Number in Supabase
  const ents = await db.getEntities();
  const cltd = ents.find(e => e.entity_code === 'CLTD') || ents[0];

  const testBankPayload = {
    bank_name: 'Standard Chartered Acceptance Bank',
    account_holder: 'Corevow Limited',
    account_number: 'ACC-BD-889900112233',
    branch: 'Gulshan 2 Branch',
    routing_number: '010271829',
    swift_bic: 'SCBLBDDH',
    bank_address: 'Gulshan Avenue, Dhaka, Bangladesh',
    is_active: true
  };

  const savedBank = await db.saveBankAccount(cltd.id, testBankPayload);
  assert(!!savedBank.id, `4. Bank account saved successfully in Supabase (ID: ${savedBank.id})`);

  // Direct Supabase Query Verification for Bank Account
  const { data: dbBank, error: bankErr } = await supabase
    .from('entity_bank_accounts')
    .select('*')
    .eq('id', savedBank.id)
    .single();

  assert(!bankErr && !!dbBank, '5. Directly queried created bank account from Supabase PostgreSQL table entity_bank_accounts');

  // 4. Acceptance Step 3: Create an Invoice with Two Items (Atomic Creation)
  const { data: existingProfile } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
  const creatorId = existingProfile?.id || null;

  const invoiceId = crypto.randomUUID();
  const secureToken = crypto.randomUUID();
  const invoiceNumber = `ACCEPT-${Date.now().toString(36).toUpperCase()}`;

  const invoiceRecord = {
    id: invoiceId,
    secure_token: secureToken,
    invoice_number: invoiceNumber,
    status: 'draft',
    entity_id: cltd.id,
    client_id: createdClient.id,
    currency: 'USD',
    issue_date: new Date().toISOString().split('T')[0],
    payment_terms: 'NET_30',
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    project_name: 'Enterprise Cloud SaaS Migration',
    service_period: 'Q3 2026',
    po_number: 'PO-2026-ACCEPTANCE',
    reference_number: 'REF-ACC-001',
    account_manager_id: null,
    discount_type: 'fixed',
    discount_value: 0,
    vat_rate: 0,
    vat_inclusive: true,
    client_note: 'Thank you for your business.',
    payment_instructions: 'Wire transfer to primary account.',
    terms_conditions: 'Standard SaaS Terms apply.',
    internal_note: 'Automated Preview Acceptance Record',
    created_by: creatorId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const item1Id = crypto.randomUUID();
  const item2Id = crypto.randomUUID();

  const invoiceItems = [
    {
      id: item1Id,
      invoice_id: invoiceId,
      service_name: 'Cloud Architecture Setup',
      description: 'Cloud Architecture Setup & Supabase Migration',
      quantity: 1,
      unit: 'job',
      rate: 3500.00,
      amount: 3500.00,
      sort_order: 1
    },
    {
      id: item2Id,
      invoice_id: invoiceId,
      service_name: 'PostgreSQL Policy Audit',
      description: 'PostgreSQL Multi-Tenant RLS & Security Policy Audit',
      quantity: 2,
      unit: 'hrs',
      rate: 1250.00,
      amount: 2500.00,
      sort_order: 2
    }
  ];

  const createdInvoice = await db.createInvoice(invoiceRecord as any, invoiceItems as any);
  assert(!!createdInvoice.id, `6. Invoice created atomically in Supabase (ID: ${createdInvoice.id})`);

  // Direct Supabase Query Verification for Invoice & Items
  const { data: dbInvoice, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', createdInvoice.id)
    .single();

  assert(!invErr && !!dbInvoice, '7. Directly queried created invoice from Supabase PostgreSQL table invoices');

  const { data: dbItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', createdInvoice.id)
    .order('sort_order');

  assert(!itemsErr && dbItems?.length === 2, '8. Directly queried 2 invoice items from Supabase PostgreSQL table invoice_items');

  console.log('\n==================================================');
  console.log('EXACT SUPABASE POSTGRESQL ROWS CREATED (PREVIEW ACCEPTANCE)');
  console.log('==================================================\n');

  console.log('--- 1. TABLE: billing_clients ---');
  console.log(JSON.stringify(dbClient, null, 2));

  console.log('\n--- 2. TABLE: entity_bank_accounts ---');
  console.log(JSON.stringify(dbBank, null, 2));

  console.log('\n--- 3. TABLE: invoices ---');
  console.log(JSON.stringify(dbInvoice, null, 2));

  console.log('\n--- 4. TABLE: invoice_items ---');
  console.log(JSON.stringify(dbItems, null, 2));

  console.log('\n==================================================');
  console.log('ALL PREVIEW ACCEPTANCE TESTS PASSED CLEANLY');
  console.log('==================================================');
}

runPreviewAcceptanceTest().catch(err => {
  console.error('❌ Preview acceptance test failed!');
  console.error(err.message || err);
  process.exit(1);
});
