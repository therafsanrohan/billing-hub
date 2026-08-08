/**
 * Default Bank Account & Routing Details Persistence Test Suite
 * Verifies that bank accounts and routing transit numbers are correctly upserted and retrieved.
 */

import { db } from '../src/lib/db';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function runBankAccountTests() {
  console.log('Running Default Bank Account & Routing Details Persistence Tests...');

  const ents = await db.getEntities();
  assert(ents.length > 0, '1. Business entities fetched successfully');

  const cltd = ents.find(e => e.entity_code === 'CLTD') || ents[0];

  const testRouting = '999888777';
  const savedBank = await db.saveBankAccount(cltd.id, {
    bank_name: 'Test Persistent Bank BD',
    account_holder: 'Corevow Limited',
    account_number: '112233445566',
    branch: 'Gulshan Branch',
    routing_number: testRouting,
    swift_bic: 'TESTBDDH',
    bank_address: 'Dhaka, Bangladesh',
    is_active: true
  });

  assert(savedBank.routing_number === testRouting, '2. saveBankAccount returns saved routing number');
  assert(typeof savedBank.id === 'string' && savedBank.id.length > 0, '3. Saved bank record has valid ID');

  const banks = await db.getBankAccounts();
  const fetchedBank = banks.find(b => b.entity_id === cltd.id && b.is_active);
  assert(fetchedBank !== undefined, '4. Bank account found in getBankAccounts list');
  assert(fetchedBank?.routing_number === testRouting, '5. Routing number matches saved value in cloud database list');

  console.log('All Default Bank Account & Routing Details Tests Passed Successfully!');
}

runBankAccountTests().catch(err => {
  console.error('❌ Bank account routing test execution failed!');
  console.error(err.message || err);
  process.exit(1);
});
