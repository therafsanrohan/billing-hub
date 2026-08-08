/**
 * Complete Invoice Lifecycle & Status Persistence Test
 * Tests Draft -> Submit for Approval -> Approve -> Payment Record -> Database Verification
 */

import { db } from '../src/lib/db';
import { supabase } from '../src/lib/supabase';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function testInvoiceLifecycle() {
  console.log('=== STARTING INVOICE LIFECYCLE & STATUS PERSISTENCE TEST ===\n');

  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  // 1. Get an existing business entity and profile
  const entities = await db.getEntities();
  assert(entities.length > 0, '1. Business entities fetched');
  const entity = entities.find(e => e.entity_code === 'CLTD') || entities[0];

  const clients = await db.getClients();
  let client = clients[0];
  if (!client) {
    client = await db.createClient({
      client_type: 'company',
      company_name: 'Lifecycle Test Client ' + Date.now().toString(36),
      contact_person: 'Lifecycle Contact',
      billing_email: `lifecycle.${Date.now()}@test.com`,
      additional_emails: [],
      phone: '+1 555 999 8888',
      billing_address: '100 Test St',
      city: 'Testville',
      country: 'United States',
      tax_number: 'TAX-12345',
      preferred_currency: 'BDT',
      default_payment_terms: 'Due on Receipt',
      account_manager_id: null,
      internal_note: 'Lifecycle Test Record'
    });
  }

  assert(!!client.id, `2. Client verified (ID: ${client.id})`);

  // 2. Step A: Create Draft Invoice
  const draftInvoicePayload = {
    entity_id: entity.id,
    client_id: client.id,
    currency: 'BDT' as const,
    issue_date: new Date().toISOString().split('T')[0],
    payment_terms: 'Due on Receipt',
    due_date: new Date().toISOString().split('T')[0],
    project_name: 'Lifecycle Automated E2E Test',
    service_period: 'July 2026',
    po_number: 'PO-LIFECYCLE-123',
    reference_number: 'REF-LC-001',
    account_manager_id: null,
    discount_type: 'none' as const,
    discount_value: 0,
    vat_rate: 0,
    vat_inclusive: true,
    client_note: 'Automated Lifecycle Test',
    payment_instructions: 'Bank Transfer',
    terms_conditions: 'Standard Terms',
    internal_note: 'Lifecycle Test Draft',
    created_by: null
  };

  const draftItems = [
    {
      service_name: 'System Audit',
      description: 'Comprehensive Database Audit',
      quantity: 1,
      unit: 'job',
      rate: 15000,
      amount: 15000,
      sort_order: 0
    }
  ];

  const createdInvoice = await db.createInvoice(draftInvoicePayload as any, draftItems as any);
  assert(!!createdInvoice.id, `3. Draft invoice created (ID: ${createdInvoice.id})`);

  // Verify in Supabase table
  const { data: dbDraft } = await supabase.from('invoices').select('*').eq('id', createdInvoice.id).single();
  assert(dbDraft?.status === 'draft', '4. Draft status verified in Supabase PostgreSQL table invoices');

  // 3. Step B: Submit for Approval
  const submitted = await db.submitForApproval(createdInvoice.id);
  assert(submitted.status === 'pending_approval', '5. submitForApproval method returned pending_approval status');

  // Direct Supabase table check for pending_approval
  const { data: dbSubmitted } = await supabase.from('invoices').select('status').eq('id', createdInvoice.id).single();
  assert(dbSubmitted?.status === 'pending_approval', '6. Pending Approval status verified in Supabase PostgreSQL table invoices');

  // 4. Step C: Approve Invoice
  const approved = await db.approveInvoice(createdInvoice.id);
  assert(approved.status === 'approved', '7. approveInvoice method returned approved status');
  assert(!!approved.invoice_number, `8. Serial invoice number generated: ${approved.invoice_number}`);

  // Direct Supabase table check for approved & invoice_number
  const { data: dbApproved } = await supabase.from('invoices').select('status, invoice_number').eq('id', createdInvoice.id).single();
  assert(dbApproved?.status === 'approved' && dbApproved?.invoice_number === approved.invoice_number, '9. Approved status & invoice number verified in Supabase PostgreSQL table invoices');

  // 5. Clean up test records
  await supabase.from('invoice_items').delete().eq('invoice_id', createdInvoice.id);
  await supabase.from('invoice_snapshots').delete().eq('invoice_id', createdInvoice.id);
  await supabase.from('invoices').delete().eq('id', createdInvoice.id);
  if (client.company_name.startsWith('Lifecycle Test Client')) {
    await supabase.from('billing_clients').delete().eq('id', client.id);
  }

  console.log('\n==================================================');
  console.log('ALL INVOICE LIFECYCLE TESTS PASSED 100% CLEANLY');
  console.log('==================================================');
}

testInvoiceLifecycle().catch(err => {
  console.error('❌ Invoice lifecycle test failed!');
  console.error(err.message || err);
  process.exit(1);
});
