/**
 * Company Reserve & Savings Management USD Integration Test
 * Verifies live Supabase persistence and currency calculations for:
 * 1. USD Reserve Ledger manual deposits
 * 2. USD FDR accounts creation & querying
 * 3. USD DPS accounts creation & querying
 * 4. USD Withdrawal requests creation & querying
 * 5. USD Reserve dashboard summary calculation
 */

import { db } from '../src/lib/db';
import { getPublicSupabaseConfig } from '../src/lib/supabase/config';
import { createClient } from '@supabase/supabase-js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function runReserveUsdIntegrationTest() {
  console.log('=== STARTING COMPANY RESERVE & SAVINGS USD INTEGRATION TEST ===\n');

  const config = getPublicSupabaseConfig();
  const supabase = createClient(config.supabaseUrl, config.publishableKey);
  
  const entities = await db.getEntities();
  const cllcEntity = entities.find(e => e.entity_code === 'CLLC') || entities[0];
  assert(cllcEntity !== undefined, `1. Found USD Business Entity: ${cllcEntity.legal_name} (${cllcEntity.id})`);

  const currentUser = await db.getCurrentUser();
  assert(currentUser !== null, `2. Loaded system user: ${currentUser.full_name}`);

  let depositEntry: any = null;
  let fdrAccount: any = null;
  let dpsAccount: any = null;
  let withdrawalReq: any = null;

  try {
    // 2. Insert USD Manual Deposit in Reserve Ledger
    console.log('\n--- 2. Testing USD Reserve Ledger Deposit ---');
    depositEntry = await db.addReserveLedgerEntry({
      entity_id: cllcEntity.id,
      currency: 'USD',
      transaction_type: 'MANUAL_DEPOSIT',
      amount: 1500,
      source: 'WIRE_TRANSFER',
      deposit_date: new Date().toISOString().split('T')[0],
      reason: 'USD Corporate Reserve Investment',
      status: 'COMPLETED',
      created_by: currentUser.full_name,
      approved_by: currentUser.full_name
    }, currentUser);

    assert(depositEntry.id !== undefined, `2a. USD Manual Deposit recorded in Supabase (ID: ${depositEntry.id})`);
    assert(depositEntry.currency === 'USD', '2b. Transaction currency is USD');

    // Query directly from Supabase
    const { data: dbDeposit } = await supabase.from('reserve_ledger').select('*').eq('id', depositEntry.id).maybeSingle();
    assert(dbDeposit?.amount === 1500 && dbDeposit?.currency === 'USD', '2c. Verified USD deposit directly in Supabase reserve_ledger table');

    // 3. Create USD FDR Account
    console.log('\n--- 3. Testing USD FDR Account Creation ---');
    fdrAccount = await db.createFdrAccount({
      entity_id: cllcEntity.id,
      bank_name: 'JP Morgan Chase Bank',
      branch_name: 'New York Main Branch',
      account_title: 'Corevow LLC USD Reserve FDR',
      fdr_reference_number: `JPMC-USD-FDR-${Date.now().toString().slice(-4)}`,
      principal_amount: 10000,
      currency: 'USD',
      interest_rate: 5.25,
      rate_type: 'SIMPLE',
      start_date: '2026-07-24',
      maturity_date: '2027-07-24',
      tenure_months: 12,
      expected_gross_return: 525,
      expected_tax_deduction: 52.5,
      expected_bank_charges: 25,
      expected_net_maturity_value: 10447.5,
      auto_renewal: true,
      lien_status: false,
      funding_source: 'Company USD Reserve',
      status: 'ACTIVE',
      notes: 'USD fixed deposit for yield',
      created_by: currentUser.full_name
    }, currentUser);

    assert(fdrAccount.id !== undefined, `3a. USD FDR Account created in Supabase (ID: ${fdrAccount.id})`);
    assert(fdrAccount.principal_amount === 10000, '3b. USD FDR principal is $10,000 USD');

    const { data: dbFdr } = await supabase.from('fdr_accounts').select('*').eq('id', fdrAccount.id).maybeSingle();
    assert(dbFdr?.currency === 'USD' && dbFdr?.principal_amount === 10000, '3c. Verified USD FDR directly in Supabase fdr_accounts table');

    // 4. Create USD DPS Account
    console.log('\n--- 4. Testing USD DPS Account Creation ---');
    dpsAccount = await db.createDpsAccount({
      entity_id: cllcEntity.id,
      bank_name: 'Standard Chartered US',
      branch_name: 'Wall Street Branch',
      account_title: 'Corevow LLC USD Savings DPS',
      dps_account_number: `SCB-USD-DPS-${Date.now().toString().slice(-4)}`,
      currency: 'USD',
      installment_amount: 500,
      payment_frequency: 'MONTHLY',
      start_date: '2026-07-24',
      next_installment_date: '2026-08-24',
      maturity_date: '2028-07-24',
      total_installments: 24,
      paid_installments: 1,
      remaining_installments: 23,
      total_deposited_amount: 500,
      expected_interest_amount: 1440,
      expected_maturity_value: 13440,
      late_payment_charge: 0,
      missed_installments_count: 0,
      grace_period_days: 5,
      auto_debit: true,
      funding_source: 'Company USD Reserve',
      status: 'ACTIVE',
      notes: 'USD monthly DPS investment scheme',
      created_by: currentUser.full_name
    }, currentUser);

    assert(dpsAccount.id !== undefined, `4a. USD DPS Account created in Supabase (ID: ${dpsAccount.id})`);
    assert(dpsAccount.installment_amount === 500, '4b. USD DPS monthly installment is $500 USD');

    const { data: dbDps } = await supabase.from('dps_accounts').select('*').eq('id', dpsAccount.id).maybeSingle();
    assert(dbDps?.currency === 'USD' && dbDps?.installment_amount === 500, '4c. Verified USD DPS directly in Supabase dps_accounts table');

    // 5. Create USD Reserve Withdrawal Request
    console.log('\n--- 5. Testing USD Reserve Withdrawal Request ---');
    withdrawalReq = await db.createWithdrawalRequest({
      entity_id: cllcEntity.id,
      currency: 'USD',
      requested_amount: 2000,
      purpose: 'USD Cloud Infrastructure Scale-up',
      detailed_reason: 'Unforeseen GPU server expansion needed for AI workloads.',
      emergency_category: 'EMERGENCY_OPERATIONS',
      requested_by: currentUser.full_name,
      request_date: new Date().toISOString().split('T')[0],
      destination_account: 'Corevow LLC USD Operating Account'
    }, currentUser);

    assert(withdrawalReq.id !== undefined, `5a. USD Withdrawal request created in Supabase (ID: ${withdrawalReq.id})`);
    assert(withdrawalReq.requested_amount === 2000, '5b. USD Withdrawal requested amount is $2,000 USD');

    // 6. Verify Dashboard USD Aggregated Summary
    console.log('\n--- 6. Auditing Live USD Dashboard Aggregated Summary ---');
    const usdSummary = await db.getReserveDashboardSummary('all', 'USD');
    
    assert(usdSummary.netReserveCash === -8500, `6a. USD Net Reserve Cash is $${usdSummary.netReserveCash.toLocaleString()} USD ($1,500 deposit - $10,000 FDR transfer)`);
    assert(usdSummary.totalFdrPrincipal === 10000, `6b. USD FDR Principal is $${usdSummary.totalFdrPrincipal.toLocaleString()} USD`);
    assert(usdSummary.totalDpsDeposited === 500, `6c. USD DPS Total Deposited is $${usdSummary.totalDpsDeposited.toLocaleString()} USD`);
    assert(usdSummary.totalCompanySavings === 2000, `6d. USD Total Company Savings is $${usdSummary.totalCompanySavings.toLocaleString()} USD (Cash + FDR + DPS)`);

  } finally {
    // 7. Clean up test records
    console.log('\n--- 7. Cleaning up test records from Supabase ---');
    if (depositEntry?.id) await supabase.from('reserve_ledger').delete().eq('id', depositEntry.id);
    if (fdrAccount?.fdr_reference_number) {
      await supabase.from('reserve_ledger').delete().eq('reason', `Internal asset transfer: Created FDR #${fdrAccount.fdr_reference_number} at ${fdrAccount.bank_name}`);
      await supabase.from('fdr_accounts').delete().eq('id', fdrAccount.id);
    }
    if (dpsAccount?.id) {
      await supabase.from('dps_installments').delete().eq('dps_account_id', dpsAccount.id);
      await supabase.from('dps_accounts').delete().eq('id', dpsAccount.id);
    }
    if (withdrawalReq?.id) await supabase.from('reserve_withdrawal_requests').delete().eq('id', withdrawalReq.id);
    console.log('✓ Cleaned up all USD integration test records from Supabase');
  }

  console.log('\n=== COMPANY RESERVE & SAVINGS USD INTEGRATION TEST PASSED 100%! ===');
}

runReserveUsdIntegrationTest().catch((err: any) => {
  console.error('❌ USD Integration Test Failed!');
  console.error(err.message);
  process.exit(1);
});
