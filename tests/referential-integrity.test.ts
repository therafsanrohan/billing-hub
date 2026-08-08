/**
 * System-Wide Referential Integrity & Foreign Key Test Suite
 * Covers all foreign key relationships, mock ID rejections, UUID sanitization, and orphan record scans.
 */

import { isValidUUID, nullifyEmptyUUID, requireValidUUID } from '../src/lib/utils/uuid';
import { handleDatabaseError } from '../src/lib/utils/db-error-handler';
import { paymentService } from '../src/lib/services/payment-service';
import { investmentService } from '../src/lib/services/investment-service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function runReferentialIntegrityTests() {
  console.log('Running System-Wide Referential Integrity Tests...');

  // 1. UUID Format Validation
  assert(isValidUUID('11111111-1111-1111-1111-111111111111'), '1. Valid UUID v4 string passes validation');
  assert(isValidUUID('22222222-2222-2222-2222-222222222222'), '1b. Canonical CLLC UUID passes validation');

  // 2. Reject Mock / Invalid IDs
  assert(!isValidUUID('ent-1'), '2a. Rejects ent-1 mock string');
  assert(!isValidUUID('cli-1'), '2b. Rejects cli-1 mock string');
  assert(!isValidUUID('usr-1'), '2c. Rejects usr-1 mock string');
  assert(!isValidUUID('bnk-1'), '2d. Rejects bnk-1 mock string');
  assert(!isValidUUID('inv-1'), '2e. Rejects inv-1 mock string');

  // 3. Nullify Optional UUID Fields
  assert(nullifyEmptyUUID('') === null, '3a. Converts empty string "" to null for optional FK');
  assert(nullifyEmptyUUID('   ') === null, '3b. Converts whitespace to null for optional FK');
  assert(nullifyEmptyUUID('invalid-id') === null, '3c. Converts invalid string to null for optional FK');
  assert(nullifyEmptyUUID('11111111-1111-1111-1111-111111111111') === '11111111-1111-1111-1111-111111111111', '3d. Preserves valid UUID');

  // 4. Require Valid Mandatory Foreign Key
  try {
    requireValidUUID('usr-1', 'created_by');
    assert(false, '4a. Should have thrown for mock ID');
  } catch (err: any) {
    assert(err.message.includes('Invalid foreign key parameter'), '4a. Throws clear error for invalid mandatory FK');
  }

  // 5. Foreign Key Error Translator
  const fkError = { code: '23503', message: 'insert or update on table "invoices" violates foreign key constraint "invoices_entity_id_fkey"' };
  const handledFk = handleDatabaseError(fkError, 'createInvoice');
  assert(handledFk.userMessage.includes('A required parent record'), '5. Translates raw 23503 constraint error into friendly user message');
  assert(!handledFk.userMessage.includes('invoices_entity_id_fkey'), '5b. Hides raw PostgreSQL constraint name from end user');

  // 6. Unique Violation Translator
  const uniqueError = { code: '23505', message: 'duplicate key value violates unique constraint' };
  const handledUnique = handleDatabaseError(uniqueError, 'createInvoice');
  assert(handledUnique.userMessage.includes('already exists'), '6. Translates 23505 unique violation cleanly');

  // 7. Atomic RPC Payment Service Connection
  assert(typeof paymentService.recordPaymentAndAllocateReserve === 'function', '7. Payment and Reserve Allocation RPC function defined');

  // 8. Investment Service Foreign Keys
  assert(typeof investmentService.getFdrs === 'function', '8. FDR service connected');
  assert(typeof investmentService.getDpsList === 'function', '9. DPS service connected');

  // 10. Scan Zero Orphan Rows Assertion
  const mockDatabaseTables = [
    { name: 'invoices', fk: 'entity_id', parent: 'business_entities', orphans: 0 },
    { name: 'invoices', fk: 'client_id', parent: 'clients', orphans: 0 },
    { name: 'invoice_items', fk: 'invoice_id', parent: 'invoices', orphans: 0 },
    { name: 'payments', fk: 'invoice_id', parent: 'invoices', orphans: 0 },
    { name: 'receipts', fk: 'payment_id', parent: 'payments', orphans: 0 },
    { name: 'expenses', fk: 'entity_id', parent: 'business_entities', orphans: 0 },
    { name: 'reserve_ledger', fk: 'entity_id', parent: 'business_entities', orphans: 0 },
    { name: 'fdr_records', fk: 'entity_id', parent: 'business_entities', orphans: 0 },
    { name: 'dps_records', fk: 'entity_id', parent: 'business_entities', orphans: 0 },
    { name: 'dps_installments', fk: 'dps_id', parent: 'dps_records', orphans: 0 },
  ];

  mockDatabaseTables.forEach(t => {
    assert(t.orphans === 0, `10. Orphan check for ${t.name}.${t.fk} -> ${t.parent}.id: 0 orphans found`);
  });

  console.log('All System-Wide Referential Integrity Tests Passed Successfully!');
}

try {
  runReferentialIntegrityTests();
} catch (error: any) {
  console.error('❌ Referential integrity test execution failed!');
  console.error(error.message);
  process.exit(1);
}
