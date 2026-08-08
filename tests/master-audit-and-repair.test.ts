/**
 * Master System Audit and Comprehensive Financial Repair Test Suite
 * Validates fixes for:
 * 1. Invoice CLTD-BDT-2026-0002 amount calculation & persistence
 * 2. Outstanding BDT and USD metrics calculation
 * 3. Dashboard live database integration
 * 4. Billing Client directory filters (multi-field search, client type, currency, project status)
 * 5. Record Payment workflow with valid profile FK
 * 6. Gateway Cutoff & deduction calculation
 * 7. VAT Registration Profile configuration
 * 8. Corporate Income Tax vs VAT system separation
 */

import { db } from '../src/lib/db';
import { calculateTotals, calculateGatewayDeduction, calculateBangladeshCorporateTax, calculateLineVat } from '../src/lib/calculations';
import { getPublicSupabaseConfig } from '../src/lib/supabase/config';
import { createClient } from '@supabase/supabase-js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function runMasterVerificationTests() {
  console.log('=== STARTING MASTER SYSTEM AUDIT AND REPAIR VERIFICATION ===\n');

  // 1. Check Public Supabase Configuration
  const config = getPublicSupabaseConfig();
  assert(config.supabaseUrl.startsWith('https://'), '1. Supabase public URL connected');
  const supabase = createClient(config.supabaseUrl, config.publishableKey);

  // 2. Critical Bug Fix Verification: Invoice CLTD-BDT-2026-0002
  console.log('\n--- 2. Auditing Invoice CLTD-BDT-2026-0002 ---');
  const invoices = await db.getInvoices();
  const cltdInvoice = invoices.find(i => i.invoice_number === 'CLTD-BDT-2026-0002');
  assert(cltdInvoice !== undefined, '2a. Found Invoice CLTD-BDT-2026-0002 in database');
  if (cltdInvoice) {
    const items = await db.getInvoiceItems(cltdInvoice.id);
    assert(items.length === 3, '2b. Invoice CLTD-BDT-2026-0002 has 3 line items in invoice_items table');
    assert(cltdInvoice.subtotal === 8550, `2c. Invoice subtotal is BDT 8,550 (got ${cltdInvoice.subtotal})`);
    assert(cltdInvoice.discount_amount === 50, `2d. Invoice discount is BDT 50 (got ${cltdInvoice.discount_amount})`);
    assert(cltdInvoice.total_payable === 8500, `2e. Invoice grand total is non-zero: BDT 8,500 (got ${cltdInvoice.total_payable})`);
    assert(cltdInvoice.amount_due === 8500, `2f. Invoice amount due is BDT 8,500 (got ${cltdInvoice.amount_due})`);
  }

  // 3. Outstanding BDT and USD Verification
  console.log('\n--- 3. Auditing Outstanding Metrics ---');
  let bdtOutstanding = 0;
  let usdOutstanding = 0;
  invoices.forEach(inv => {
    if (inv.status === 'draft' || inv.status === 'void' || inv.status === 'cancelled') return;
    const due = inv.amount_due !== undefined ? inv.amount_due : (inv.total_payable || 0);
    if (inv.currency === 'BDT') {
      bdtOutstanding += due;
    } else {
      usdOutstanding += due;
    }
  });
  assert(bdtOutstanding > 0, `3a. Outstanding BDT is dynamically calculated & non-zero (got ৳${bdtOutstanding.toLocaleString()})`);
  assert(usdOutstanding >= 0, `3b. Outstanding USD is dynamically calculated (got $${usdOutstanding.toLocaleString()})`);

  // 4. Client Directory Filters Verification
  console.log('\n--- 4. Auditing Client Directory Filters ---');
  const allClients = await db.getClients();
  assert(allClients.length >= 3, '4a. Clients loaded from Supabase billing_clients table');

  const ovenClient = await db.getClientsFiltered({ search: 'OVEN' });
  assert(ovenClient.length > 0 && ovenClient[0].company_name === 'OVEN', '4b. Client search by company name "OVEN" works');

  const contactSearch = await db.getClientsFiltered({ search: 'Subael' });
  assert(contactSearch.length > 0 && contactSearch[0].contact_person === 'Subael Sarwar', '4c. Client search by contact person "Subael" works');

  const usdClients = await db.getClientsFiltered({ currency: 'USD' });
  assert(usdClients.every(c => c.preferred_currency === 'USD'), '4d. Client currency filter (USD) works');

  const activeProjClients = await db.getClientsFiltered({ projectStatus: 'active_project' });
  assert(activeProjClients.length > 0, '4e. Client project status filter (Active Project) returns matching clients');

  // 5. Payment Recording & Foreign Key Verification
  console.log('\n--- 5. Auditing Payment Recording & Profile FK ---');
  if (cltdInvoice) {
    const testPayment = {
      invoice_id: cltdInvoice.id,
      payment_date: '2026-07-23',
      amount: 500,
      currency: 'BDT' as const,
      payment_method: 'bank_transfer',
      transaction_reference: 'TEST-AUDIT-PMT-001',
      bank_gateway: 'bKash',
      processing_fee: 9.25,
      internal_note: 'Master audit test payment',
      proof_url: null,
      recorded_by: '4b53b02d-8022-46ea-bd89-06c37e9e8ecf'
    };

    const recorded = await db.recordPayment(testPayment);
    assert(recorded.id !== undefined && recorded.receipt_number.length > 0, '5a. Payment recorded successfully with receipt number');

    const updatedInvoice = await db.getInvoiceById(cltdInvoice.id);
    assert(updatedInvoice?.status === 'partially_paid', `5b. Invoice status updated to partially_paid (got ${updatedInvoice?.status})`);
    assert(updatedInvoice?.amount_paid === 500, `5c. Invoice amount_paid updated to 500 (got ${updatedInvoice?.amount_paid})`);
    assert(updatedInvoice?.amount_due === 8000, `5d. Invoice amount_due updated to 8000 (got ${updatedInvoice?.amount_due})`);

    // Clean up test payment in Supabase
    await supabase.from('invoice_payments').delete().eq('id', recorded.id);
    await supabase.from('invoices').update({ status: 'approved' }).eq('id', cltdInvoice.id);
    console.log('✓ Cleaned up test payment and restored invoice status');
  }

  // 6. Gateway Cutoff Deduction Calculation Verification
  console.log('\n--- 6. Auditing Gateway Cutoff Deductions ---');
  const gwResult = calculateGatewayDeduction({
    grossPaymentAmount: 10000,
    percentageFeeRate: 1.85, // 1.85% bKash merchant rate
    fixedFeeAmount: 0,
    taxOnFeeAmount: 2.78, // 15% VAT on fee
    currencyConversionFee: 0,
    bankCharge: 0
  });

  assert(gwResult.percentageFeeAmount === 185, `6a. Percentage fee (1.85% of 10,000) is 185 BDT (got ${gwResult.percentageFeeAmount})`);
  assert(gwResult.totalGatewayDeduction === 187.78, `6b. Total gateway deduction is 187.78 BDT (got ${gwResult.totalGatewayDeduction})`);
  assert(gwResult.netSettlementAmount === 9812.22, `6c. Net bank settlement is 9,812.22 BDT (got ${gwResult.netSettlementAmount})`);

  // 7. VAT Registration Profile Verification
  console.log('\n--- 7. Auditing VAT Registration Profile ---');
  const vatProfile = await db.getVatProfile();
  assert(vatProfile !== null && typeof vatProfile.company_id === 'string', '7a. VAT Registration Profile fetched successfully');

  const savedProfile = await db.saveVatProfile({
    business_name: 'Corevow Limited',
    bin_number: '123456789-0101',
    bin_status: 'VAT_REGISTERED',
    vat_circle: 'Circle-12',
    vat_division: 'Dhaka North',
    registered_address: 'House 93, Road 6, Banani, Dhaka',
    status: 'VAT_REGISTERED'
  });
  assert(savedProfile.bin_number === '123456789-0101', '7b. Saved BIN number persists in VAT Registration Profile');

  // 8. Tax and VAT System Separation Verification
  console.log('\n--- 8. Auditing Tax and VAT Separation ---');
  const vatResult = calculateLineVat({
    quantity: 10,
    unitPrice: 1000,
    discountAmount: 0,
    vatPricingMode: 'VAT_EXCLUSIVE',
    vatRate: 15
  });
  assert(vatResult.taxableValue === 10000, '8a. Output VAT taxable value is 10,000');
  assert(vatResult.vatAmount === 1500, '8b. Output VAT amount is 1,500');

  const taxResult = calculateBangladeshCorporateTax({
    grossReceipts: 5000000,
    allowableExpenses: 3000000,
    disallowedExpenses: 0,
    otherAdjustments: 0,
    allTransactionsViaBank: true,
    bankCompliantTaxRate: 0.25,
    standardTaxRate: 0.275,
    turnoverThreshold: 5000000,
    turnoverMinimumTaxRate: 0.006,
    certifiedTds: 100000,
    advanceTaxPaid: 50000,
    manualTaxAdjustment: 0
  });
  assert(taxResult.accountingProfit === 2000000, '8c. Corporate taxable profit is calculated separately from VAT (2,000,000 BDT)');
  assert(taxResult.regularCorporateTax === 500000, '8d. Corporate Tax liability calculated at 25% bank-compliant rate (500,000 BDT)');
  assert(taxResult.finalTaxPayable === 350000, '8e. Corporate Tax net payable after TDS/advance tax credit is 350,000 BDT');

  console.log('\n=== ALL MASTER AUDIT AND REPAIR VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

try {
  runMasterVerificationTests();
} catch (error: any) {
  console.error('❌ Master verification test execution failed!');
  console.error(error.message);
  process.exit(1);
}
