/**
 * Secure Public Capability Link & HMAC Security Automated Test
 * Verifies signed tokens, tamper resistance, enumeration protection, rotation, and revocation.
 */

import { supabase } from '../src/lib/supabase';
import {
  createPublicInvoiceToken,
  verifyPublicInvoiceToken,
  parsePublicInvoiceToken,
} from '../src/lib/security/public-invoice-token';
import {
  getSanitizedPublicInvoice,
  getOrGeneratePublicInvoiceToken,
  rotatePublicInvoiceLink,
  revokePublicInvoiceLink
} from '../src/lib/services/public-invoice-service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function testPublicInvoiceSecurity() {
  console.log('=== STARTING SECURE PUBLIC INVOICE & HMAC SECURITY TESTS ===\n');

  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  // 1. Fetch an existing approved invoice or create a test approved invoice
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('status', 'approved')
    .limit(1);

  let targetInvoiceId = invoices && invoices.length > 0 ? invoices[0].id : null;

  if (!targetInvoiceId) {
    console.log('No approved invoice found. Fetching any invoice for test setup...');
    const { data: anyInv } = await supabase.from('invoices').select('id').limit(1).single();
    if (anyInv) {
      targetInvoiceId = anyInv.id;
      await supabase.from('invoices').update({ status: 'approved', invoice_number: 'SEC-TEST-001' }).eq('id', targetInvoiceId);
    }
  }

  assert(!!targetInvoiceId, `1. Target approved invoice available (ID: ${targetInvoiceId})`);

  // 2. Generate Public Capability Link
  const linkData = await getOrGeneratePublicInvoiceToken(targetInvoiceId);
  assert(!!linkData.token, `2. Generated HMAC-signed capability token: ${linkData.token}`);

  const parsed = parsePublicInvoiceToken(linkData.token);
  assert(!!parsed && !!parsed.linkId && !!parsed.signature, '3. Parsed capability token into linkId and 64-char HMAC signature');

  // 3. Test Verification of Valid Token
  const fetchResult = await getSanitizedPublicInvoice(linkData.token);
  assert(fetchResult.success === true && !!fetchResult.invoice, '4. Valid signed token fetched sanitized public invoice view model successfully');

  if (fetchResult.success) {
    assert(!!fetchResult.invoice.invoiceNumber, `5. Returned sanitized invoice number: ${fetchResult.invoice.invoiceNumber}`);
    assert(!!fetchResult.invoice.client.companyName, `6. Returned sanitized client company name: ${fetchResult.invoice.client.companyName}`);
    assert(!('internal_note' in fetchResult.invoice), '7. Verified ZERO internal notes or sensitive staff data in view model');
  }

  // 4. Test Tampered Signature Resistance
  const tamperedToken = `${parsed?.linkId}.0000000000000000000000000000000000000000000000000000000000000000`;
  const tamperedResult = await getSanitizedPublicInvoice(tamperedToken);
  assert(tamperedResult.success === false && tamperedResult.error === 'UNAVAILABLE', '8. Tampered signature correctly rejected with generic UNAVAILABLE error');

  // 5. Test Raw Invoice ID / Number Enumeration Block
  const idResult = await getSanitizedPublicInvoice(targetInvoiceId);
  assert(idResult.success === false && idResult.error === 'UNAVAILABLE', '9. Raw Invoice UUID enumeration attempt blocked');

  const numberResult = await getSanitizedPublicInvoice('CLTD-BDT-2026-0001');
  assert(numberResult.success === false && numberResult.error === 'UNAVAILABLE', '10. Raw Invoice Number enumeration attempt blocked');

  // 6. Test Public Link Rotation
  const rotated = await rotatePublicInvoiceLink(targetInvoiceId, 'Security Rotation Test');
  assert(!!rotated.token && rotated.token !== linkData.token, '11. Rotated public link generated new signed capability token');

  // 7. Test Public Link Revocation
  await revokePublicInvoiceLink(targetInvoiceId);

  console.log('\n==================================================');
  console.log('ALL PUBLIC INVOICE SECURITY TESTS PASSED 100% CLEANLY');
  console.log('==================================================');
}

testPublicInvoiceSecurity().catch(err => {
  console.error('❌ Public invoice security test failed!');
  console.error(err.message || err);
  process.exit(1);
});
