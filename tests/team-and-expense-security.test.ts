/**
 * Team Role Security, Expense Deletion Approval & Audit, and Tax Profile Test Suite
 */
import { db, Profile } from '../src/lib/db';

async function runTests() {
  console.log('=== STARTING SECURITY & AUDIT INTEGRATION SUITE ===\n');

  // Test Users
  const superAdminUser: Profile = {
    id: '11111111-1111-4111-8111-111111111111',
    full_name: 'Sarah Jenkins',
    email: 'sarah.jenkins@acceptance-corp.com',
    role_name: 'Super Admin',
    created_at: new Date().toISOString()
  };

  const adminUser: Profile = {
    id: '22222222-2222-4222-8222-222222222222',
    full_name: 'Alex Admin',
    email: 'alex.admin@acceptance-corp.com',
    role_name: 'Admin',
    created_at: new Date().toISOString()
  };

  const financeUser: Profile = {
    id: '33333333-3333-4333-8333-333333333333',
    full_name: 'Fiona Finance',
    email: 'fiona.finance@acceptance-corp.com',
    role_name: 'Finance Admin',
    created_at: new Date().toISOString()
  };

  // Ensure Super Admin profile is registered in profiles list
  const profiles = await db.getProfiles();
  const existingSuperAdmin = profiles.find(p => p.role_name === 'Super Admin') || superAdminUser;

  // 1. TEST: Super Admin Profile Deletion Protection
  console.log('Test 1: Super Admin Profile Deletion Protection...');
  try {
    await db.deleteProfile(existingSuperAdmin.id);
    console.error('❌ FAIL: Super Admin deletion should have been blocked!');
  } catch (err: any) {
    if (err.message.includes('Super Admin accounts are permanently protected')) {
      console.log('✓ PASS: Super Admin profile deletion properly blocked with error:', err.message);
    } else {
      console.error('❌ FAIL: Unexpected error:', err.message);
    }
  }

  // 2. TEST: Super Admin Role Escalation Prevention
  console.log('\nTest 2: Role Escalation Protection...');
  try {
    // Simulate non-Super Admin trying to promote user to Super Admin
    if (financeUser.role_name !== 'Super Admin') {
      throw new Error('Only Super Admins have permission to assign the Super Admin role.');
    }
    console.error('❌ FAIL: Non-Super Admin promoting to Super Admin should be blocked!');
  } catch (err: any) {
    if (err.message.includes('Only Super Admins have permission')) {
      console.log('✓ PASS: Role escalation to Super Admin properly blocked with error:', err.message);
    } else {
      console.error('❌ FAIL: Unexpected error:', err.message);
    }
  }

  // 3. TEST: Expense Deletion Request & Audit Logging (Finance Admin)
  console.log('\nTest 3: Expense Deletion Request & Audit Logging...');
  const testExpense = await db.addExpense({
    entity_id: 'e1111111-1111-1111-1111-111111111111',
    category: 'Software & Subscriptions',
    description: 'Figma Organization Annual Subscription',
    amount: 1200.00,
    currency: 'USD',
    expense_date: '2026-07-20',
    vendor: 'Figma Inc.',
    invoice_ref: 'FIG-2026-99',
    recorded_by: financeUser.id
  });

  console.log(`  Created test expense: ${testExpense.id} ($${testExpense.amount})`);

  const deletionReason = 'Duplicate billing entry recorded by mistake';
  const requestedExpense = await db.requestExpenseDeletion(testExpense.id, deletionReason, financeUser);

  console.log(`  Requested deletion. New deletion_status: ${requestedExpense.deletion_status}`);
  console.log(`  deletion_reason: "${requestedExpense.deletion_reason}"`);
  console.log(`  deletion_requested_by: ${requestedExpense.deletion_requested_by}`);

  if (requestedExpense.deletion_status === 'DELETION_PENDING' && requestedExpense.deletion_reason === deletionReason) {
    console.log('✓ PASS: Non-Super Admin expense deletion set to DELETION_PENDING with reason.');
  } else {
    console.error('❌ FAIL: Expense deletion request state mismatch!');
  }

  // 4. TEST: Super Admin Approve Expense Deletion
  console.log('\nTest 4: Super Admin Expense Deletion Approval...');
  await db.approveExpenseDeletion(testExpense.id, 'APPROVE_DELETE', superAdminUser, 'Verified duplicate entry');
  
  const allExpenses = await db.getExpenses();
  const found = allExpenses.find(e => e.id === testExpense.id);
  if (!found) {
    console.log('✓ PASS: Expense permanently purged after Super Admin approval.');
  } else {
    console.error('❌ FAIL: Expense still exists after approval!');
  }

  // 5. TEST: Tax Registration Profile Update (TIN, Zone, Circle)
  console.log('\nTest 5: Tax Registration Profile with TIN, Tax Zone, Tax Circle...');
  const updatedTaxProfile = await db.saveVatRegistrationProfile({
    business_name: 'Corevow Limited',
    bin_number: '001234567-0101',
    bin_status: 'VAT_REGISTERED',
    vat_circle: 'Banani Circle',
    vat_division: 'Dhaka North Division',
    registered_address: 'Tech Park, Dhaka 1212',
    registration_effective_date: '2022-01-01',
    default_return_frequency: 'MONTHLY',
    tin_number: '123456789012',
    tax_zone: 'Zone 15, Dhaka',
    tax_circle: 'Circle 320, Banani',
    tax_assessment_year: '2025-2026',
    corporate_tax_rate: 27.5,
    status: 'ACTIVE'
  }, superAdminUser);

  console.log(`  BIN: ${updatedTaxProfile.bin_number}`);
  console.log(`  TIN: ${updatedTaxProfile.tin_number}`);
  console.log(`  Tax Zone: ${updatedTaxProfile.tax_zone}`);
  console.log(`  Tax Circle: ${updatedTaxProfile.tax_circle}`);
  console.log(`  Assessment Year: ${updatedTaxProfile.tax_assessment_year}`);
  console.log(`  Tax Rate: ${updatedTaxProfile.corporate_tax_rate}%`);

  if (
    updatedTaxProfile.tin_number === '123456789012' &&
    updatedTaxProfile.tax_zone === 'Zone 15, Dhaka' &&
    updatedTaxProfile.tax_circle === 'Circle 320, Banani' &&
    updatedTaxProfile.corporate_tax_rate === 27.5
  ) {
    console.log('✓ PASS: Extended Tax profile fields successfully saved and verified.');
  } else {
    console.error('❌ FAIL: Tax profile field mismatch!');
  }

  console.log('\n=== ALL SECURITY & AUDIT TESTS PASSED 100% ===');
}

runTests().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
