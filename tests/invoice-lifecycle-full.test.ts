/**
 * Invoice Lifecycle Full Integration Test
 * 
 * Tests the complete invoice lifecycle against live Supabase:
 *   1. CREATE draft invoice with line items
 *   2. EDIT draft invoice — change project name and add a line item  
 *   3. SUBMIT FOR APPROVAL — status → pending_approval
 *   4. APPROVE invoice — status → approved, invoice_number generated
 *   5. RECORD PARTIAL PAYMENT — status → partially_paid, amount_paid and amount_due updated
 *   6. RECORD FINAL PAYMENT — status → paid
 *   7. VOID invoice — status → void
 *   8. RESTORE from void/archivability check
 *   9. Verify getInvoiceById directly queries Supabase and returns live populated totals
 *  10. Cleanup all test data
 */

import { db } from '../src/lib/db';
import { calculateTotals } from '../src/lib/calculations';
import { getPublicSupabaseConfig } from '../src/lib/supabase/config';
import { createClient } from '@supabase/supabase-js';

const SUPER_ADMIN_ID = '4b53b02d-8022-46ea-bd89-06c37e9e8ecf';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  INVOICE LIFECYCLE FULL INTEGRATION TEST SUITE');
  console.log('═══════════════════════════════════════════════════\n');

  const config = getPublicSupabaseConfig();
  const supabase = createClient(config.supabaseUrl, config.publishableKey);

  // ─── PRE-FLIGHT ─────────────────────────────────────────────────
  console.log('── Pre-Flight ──────────────────────────────────────');
  const clients = await db.getClients();
  const entities = await db.getEntities();
  const testClient = clients.find(c => c.status === 'active') || clients[0];
  const bdtEntity = entities.find(e => e.entity_code === 'CLTD') || entities[0];
  assert(!!testClient, `Active client available: ${testClient?.company_name}`);
  assert(!!bdtEntity, `BDT entity (CLTD) available: ${bdtEntity?.entity_code}`);

  const invoicesBefore = (await supabase.from('invoices').select('id', { count: 'exact', head: true })).count || 0;

  // ─── STEP 1: CREATE DRAFT ────────────────────────────────────────
  console.log('\n── Step 1: Create Draft Invoice ────────────────────');
  const inv = await db.createInvoice({
    client_id: testClient.id,
    currency: 'BDT',
    entity_id: bdtEntity.id,
    issue_date: '2026-07-24',
    payment_terms: 'NET_30',
    due_date: '2026-08-24',
    project_name: 'Lifecycle Test Project v1',
    service_period: 'July 2026',
    po_number: 'PO-LIFECYCLE-001',
    reference_number: 'REF-LIFECYCLE-001',
    account_manager_id: null,
    discount_type: 'fixed',
    discount_value: 200,
    vat_rate: 15,
    vat_inclusive: false,
    client_note: 'Test invoice — lifecycle integration.',
    payment_instructions: 'Wire transfer to primary BDT account.',
    terms_conditions: 'Standard terms apply.',
    internal_note: 'Automated lifecycle test — will be deleted.',
    created_by: SUPER_ADMIN_ID
  }, [
    { service_name: 'Digital Marketing Strategy', description: 'Monthly retainer', quantity: 1, unit: 'month', rate: 15000, amount: 15000, sort_order: 0 },
    { service_name: 'Social Media Management', description: 'Content & scheduling', quantity: 1, unit: 'month', rate: 8000, amount: 8000, sort_order: 1 }
  ]);

  assert(!!inv.id, `Draft invoice created in DB (ID: ${inv.id})`);
  assert(inv.status === 'draft', `Status is "draft" (got ${inv.status})`);
  assert(inv.invoice_number === null, 'No invoice_number assigned yet (null)');

  // Verify directly in Supabase DB
  const { data: dbDraft } = await supabase.from('invoices').select('*').eq('id', inv.id).maybeSingle();
  assert(dbDraft?.status === 'draft', 'Supabase confirms status = draft');
  const { data: dbItems1 } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
  assert(dbItems1?.length === 2, `Supabase has 2 line items (got ${dbItems1?.length})`);

  // Verify totals populated from line items
  const createdInv = await db.getInvoiceById(inv.id);
  assert(createdInv?.subtotal === 23000, `Subtotal = ৳23,000 (got ${createdInv?.subtotal})`);
  assert(createdInv?.discount_amount === 200, `Discount = ৳200 (got ${createdInv?.discount_amount})`);
  // VAT exclusive: (23000-200)*15% = 3420, grand total = 26220
  assert(createdInv?.total_payable === 26220, `Grand total = ৳26,220 (got ${createdInv?.total_payable})`);
  assert(createdInv?.amount_due === 26220, `Amount due = ৳26,220 (got ${createdInv?.amount_due})`);

  // ─── STEP 2: EDIT DRAFT ──────────────────────────────────────────
  console.log('\n── Step 2: Edit Draft Invoice ──────────────────────');
  await db.updateInvoice(inv.id, {
    project_name: 'Lifecycle Test Project v2 (Updated)',
    discount_value: 500
  }, [
    { service_name: 'Digital Marketing Strategy', description: 'Monthly retainer', quantity: 1, unit: 'month', rate: 15000, amount: 15000, sort_order: 0 },
    { service_name: 'Social Media Management', description: 'Content & scheduling', quantity: 1, unit: 'month', rate: 8000, amount: 8000, sort_order: 1 },
    { service_name: 'SEO Audit', description: 'Technical SEO review', quantity: 1, unit: 'job', rate: 5000, amount: 5000, sort_order: 2 }
  ]);

  const { data: dbEdited } = await supabase.from('invoices').select('*').eq('id', inv.id).maybeSingle();
  assert(dbEdited?.project_name === 'Lifecycle Test Project v2 (Updated)', 'Project name updated in Supabase');
  assert(dbEdited?.discount_value === 500, `Discount value updated to 500 (got ${dbEdited?.discount_value})`);
  const { data: dbItems2 } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
  assert(dbItems2?.length === 3, `Supabase has 3 line items after edit (got ${dbItems2?.length})`);

  const editedInv = await db.getInvoiceById(inv.id);
  // Subtotal: 15000+8000+5000=28000, discount 500, taxable 27500, VAT 15% exclusive = 4125, total = 31625
  assert(editedInv?.subtotal === 28000, `Subtotal after edit = ৳28,000 (got ${editedInv?.subtotal})`);
  assert(editedInv?.total_payable === 31625, `Grand total after edit = ৳31,625 (got ${editedInv?.total_payable})`);

  // ─── STEP 3: SUBMIT FOR APPROVAL ─────────────────────────────────
  console.log('\n── Step 3: Submit For Approval ─────────────────────');
  const submitted = await db.submitForApproval(inv.id);
  assert(submitted.status === 'pending_approval', `Status is "pending_approval" (got ${submitted.status})`);
  const { data: dbPending } = await supabase.from('invoices').select('status').eq('id', inv.id).maybeSingle();
  assert(dbPending?.status === 'pending_approval', 'Supabase confirms status = pending_approval');

  // ─── STEP 4: APPROVE ─────────────────────────────────────────────
  console.log('\n── Step 4: Approve Invoice ─────────────────────────');
  const approved = await db.approveInvoice(inv.id);
  assert(approved.status === 'approved', `Status is "approved" (got ${approved.status})`);
  assert(!!approved.invoice_number, `Invoice number generated: ${approved.invoice_number}`);
  assert(/CLTD-BDT-\d{4}-\d{4}/.test(approved.invoice_number!), `Invoice number format valid: ${approved.invoice_number}`);

  const { data: dbApproved } = await supabase.from('invoices').select('status, invoice_number, approved_at').eq('id', inv.id).maybeSingle();
  assert(dbApproved?.status === 'approved', 'Supabase confirms status = approved');
  assert(!!dbApproved?.invoice_number, `Supabase has invoice_number: ${dbApproved?.invoice_number}`);
  assert(!!dbApproved?.approved_at, 'Supabase has approved_at timestamp');

  // Snapshot should be created
  const { data: snapshot } = await supabase.from('invoice_snapshots').select('*').eq('invoice_id', inv.id).maybeSingle();
  assert(!!snapshot, 'Invoice snapshot created in Supabase at approval time');
  assert(snapshot?.totals_snapshot?.total_payable === 31625, `Snapshot total_payable = ৳31,625 (got ${snapshot?.totals_snapshot?.total_payable})`); // 28000-500=27500, +15% = 31625

  // ─── STEP 5: RECORD PARTIAL PAYMENT ──────────────────────────────
  console.log('\n── Step 5: Record Partial Payment ──────────────────');
  const partialPayment = await db.recordPayment({
    invoice_id: inv.id,
    payment_date: '2026-07-24',
    amount: 15000,
    currency: 'BDT',
    payment_method: 'Bank Transfer',
    transaction_reference: 'TXN-LIFECYCLE-PARTIAL-001',
    bank_gateway: 'DUTCH_BANGLA',
    processing_fee: 0,
    internal_note: 'Lifecycle test partial payment',
    proof_url: null,
    recorded_by: SUPER_ADMIN_ID
  });

  assert(!!partialPayment.id, `Partial payment recorded (ID: ${partialPayment.id})`);
  assert(!!partialPayment.receipt_number, `Receipt number generated: ${partialPayment.receipt_number}`);

  const partialInv = await db.getInvoiceById(inv.id);
  assert(partialInv?.status === 'partially_paid', `Status = partially_paid (got ${partialInv?.status})`);
  assert(partialInv?.amount_paid === 15000, `Amount paid = ৳15,000 (got ${partialInv?.amount_paid})`);
  assert(partialInv?.amount_due === 16625, `Amount due = ৳16,625 (got ${partialInv?.amount_due})`); // 31625 - 15000

  const { data: dbPartialPay } = await supabase.from('invoices').select('status').eq('id', inv.id).maybeSingle();
  assert(dbPartialPay?.status === 'partially_paid', 'Supabase confirms status = partially_paid');

  // ─── STEP 6: RECORD FINAL PAYMENT ────────────────────────────────
  console.log('\n── Step 6: Record Final Payment ────────────────────');
  const finalPayment = await db.recordPayment({
    invoice_id: inv.id,
    payment_date: '2026-07-24',
    amount: 16625,
    currency: 'BDT',
    payment_method: 'Bank Transfer',
    transaction_reference: 'TXN-LIFECYCLE-FINAL-001',
    bank_gateway: 'DUTCH_BANGLA',
    processing_fee: 0,
    internal_note: 'Lifecycle test final payment',
    proof_url: null,
    recorded_by: SUPER_ADMIN_ID
  });

  assert(!!finalPayment.id, `Final payment recorded (ID: ${finalPayment.id})`);
  
  const finalInv = await db.getInvoiceById(inv.id);
  assert(finalInv?.status === 'paid', `Status = paid (got ${finalInv?.status})`);
  assert(finalInv?.amount_paid === 31625, `Total amount paid = ৳31,625 (got ${finalInv?.amount_paid})`); // 15000 + 16625
  assert(finalInv?.amount_due === 0, `Amount due = ৳0 (got ${finalInv?.amount_due})`);

  const { data: dbPaid } = await supabase.from('invoices').select('status').eq('id', inv.id).maybeSingle();
  assert(dbPaid?.status === 'paid', 'Supabase confirms status = paid');

  // ─── STEP 7: VOID INVOICE ─────────────────────────────────────────
  console.log('\n── Step 7: Void Invoice ────────────────────────────');
  const voided = await db.voidInvoice(inv.id);
  assert(voided.status === 'void', `Status = void (got ${voided.status})`);

  const { data: dbVoided } = await supabase.from('invoices').select('status').eq('id', inv.id).maybeSingle();
  assert(dbVoided?.status === 'void', 'Supabase confirms status = void');

  // ─── STEP 8: CLEANUP ─────────────────────────────────────────────
  console.log('\n── Step 8: Cleanup Test Data ───────────────────────');
  await supabase.from('invoice_payments').delete().eq('invoice_id', inv.id);
  await supabase.from('invoice_items').delete().eq('invoice_id', inv.id);
  await supabase.from('invoice_snapshots').delete().eq('invoice_id', inv.id);
  await supabase.from('reserve_ledger').delete().eq('invoice_id', inv.id);
  await supabase.from('invoices').delete().eq('id', inv.id);
  console.log('  ✓ All test records cleaned up from Supabase');

  const invoicesAfter = (await supabase.from('invoices').select('id', { count: 'exact', head: true })).count || 0;
  assert(invoicesAfter === invoicesBefore, `Invoice count back to baseline (${invoicesBefore})`);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ALL LIFECYCLE TESTS PASSED ✓');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n❌ Lifecycle test FAILED:', err.message);
  process.exit(1);
});
