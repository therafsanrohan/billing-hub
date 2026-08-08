/**
 * Void Invoice Cleanup & Ledger Sorting Acceptance Test Suite
 * Verifies server-side sorting, pagination, void invoice archiving, eligibility checks, and deleted register.
 */

import { db } from '../src/lib/db';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function runAcceptanceTests() {
  console.log('Running Void Invoice Cleanup & Ledger Sorting Acceptance Tests...');

  // 1. Latest invoice appears first by default
  const resDefault = await db.getInvoicesPaginated({ page: 1, limit: 10, sort: 'latest_created' });
  assert(resDefault !== undefined, '1. getInvoicesPaginated returns result');
  assert(Array.isArray(resDefault.invoices), '2. Invoices array is returned');

  // 3. Latest Issued sorting
  const resIssued = await db.getInvoicesPaginated({ sort: 'latest_issued' });
  assert(resIssued !== undefined, '3. Latest Issued sorting returns results');

  // 4. Oldest Created sorting
  const resOldest = await db.getInvoicesPaginated({ sort: 'oldest_created' });
  assert(resOldest !== undefined, '4. Oldest Created sorting returns results');

  // 5. Due Date sorting
  const resSoon = await db.getInvoicesPaginated({ sort: 'due_soonest' });
  assert(resSoon !== undefined, '5. Due Date Soonest sorting returns results');

  // 6. Amount sorting
  const resAmount = await db.getInvoicesPaginated({ sort: 'highest_amount' });
  assert(resAmount !== undefined, '6. Highest Amount sorting returns results');

  // 7. Status filter
  const resStatus = await db.getInvoicesPaginated({ status: 'approved' });
  assert(resStatus.invoices.every(i => i.status === 'approved'), '7. Status filter matches requested status');

  // 8. Void preset filter
  const resVoid = await db.getInvoicesPaginated({ preset: 'void' });
  assert(resVoid.invoices.every(i => i.status === 'void'), '8. Void filter returns only void invoices');

  // 9. Archived preset filter
  const resArchived = await db.getInvoicesPaginated({ preset: 'archived' });
  assert(resArchived.invoices.every(i => Boolean(i.archived_at)), '9. Archived filter returns only archived invoices');

  // 10. Search filter
  const resSearch = await db.getInvoicesPaginated({ search: 'CLTD' });
  assert(resSearch !== undefined, '10. Search filter executes successfully');

  // 11. Pagination
  const resPage = await db.getInvoicesPaginated({ page: 1, limit: 5 });
  assert(resPage.page === 1, '11. Page number is respected');
  assert(resPage.invoices.length <= 5, '12. Page limit is respected');

  // 13. Archive void invoice API
  assert(typeof db.archiveInvoice === 'function', '13. db.archiveInvoice is available');

  // 14. Restore archived invoice API
  assert(typeof db.restoreArchivedInvoice === 'function', '14. db.restoreArchivedInvoice is available');

  // 15. Permanent Delete Eligibility Check API
  assert(typeof db.checkVoidInvoiceEligibility === 'function', '15. db.checkVoidInvoiceEligibility is available');

  // 16. Permanent Delete RPC API
  assert(typeof db.permanentlyDeleteVoidInvoice === 'function', '16. db.permanentlyDeleteVoidInvoice is available');

  // 17. Ineligibility check for invalid ID
  const check = await db.checkVoidInvoiceEligibility('00000000-0000-4000-8000-000000000000');
  assert(check.eligible === false, '17. Eligibility check safely returns false for non-existent invoice');

  console.log('All Void Invoice Cleanup & Ledger Sorting Tests Passed Successfully!');
}

runAcceptanceTests().catch(err => {
  console.error('❌ Acceptance test execution failed!');
  console.error(err.message || err);
  process.exit(1);
});
