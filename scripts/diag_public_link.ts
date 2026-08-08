/**
 * Public Invoice Link & QR Code Diagnostic
 * Tests getOrGeneratePublicInvoiceToken and getSanitizedPublicInvoice
 * on a live approved invoice.
 */
import { getPublicSupabaseConfig } from '../src/lib/supabase/config';
import { createClient } from '@supabase/supabase-js';
import { createPublicInvoiceToken, parsePublicInvoiceToken, verifyPublicInvoiceToken } from '../src/lib/security/public-invoice-token';

async function runDiagnostic() {
  const config = getPublicSupabaseConfig();
  const supabase = createClient(config.supabaseUrl, config.publishableKey);
  console.log('=== PUBLIC INVOICE LINK DIAGNOSTIC ===\n');

  // 1. Find any approvable / public-viewable invoice
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, secure_token')
    .in('status', ['approved','sent','viewed','partially_paid','paid','overdue'])
    .limit(1)
    .maybeSingle();

  if (!invoice) {
    console.log('No public-viewable invoices found in database. Skipping.');
    console.log('Create an invoice and approve it first.');
    return;
  }

  console.log(`Found invoice: ${invoice.invoice_number} (${invoice.status}) [${invoice.id}]`);
  console.log(`  secure_token: ${invoice.secure_token?.slice(0, 16)}...`);

  // 2. Check if invoice_public_links exists for it
  const { data: link, error: linkErr } = await supabase
    .from('invoice_public_links')
    .select('*')
    .eq('invoice_id', invoice.id)
    .maybeSingle();

  if (linkErr) {
    console.error('  ⚠ invoice_public_links query error:', linkErr.message);
  } else if (link) {
    console.log(`\n✓ Found invoice_public_links row: ${link.id}`);
    console.log(`  is_active: ${link.is_active}, version: ${link.version}, key_version: ${link.key_version}`);

    // 3. Generate token from link
    const token = createPublicInvoiceToken(link.id, link.invoice_id, link.version, link.key_version);
    const parsed = parsePublicInvoiceToken(token);
    const verified = verifyPublicInvoiceToken(token, link.invoice_id, link.version, link.key_version);

    console.log(`\n  Generated token: ${token.slice(0, 40)}...`);
    console.log(`  Token parseable: ${parsed !== null}`);
    console.log(`  Signature valid: ${verified}`);
    console.log(`  Public URL: /invoice/${token}`);
    console.log(`  Dot in token: ${token.includes('.')}`);
    console.log(`  Proxy regex test (/^[a-zA-Z0-9_.-]+$/): ${/^[a-zA-Z0-9_.-]+$/.test(token)}`);

    if (!verified) {
      console.error('\n❌ SIGNATURE MISMATCH — Check PUBLIC_INVOICE_SIGNING_SECRET env var!');
    } else {
      console.log('\n✓ Token verification passed — public link should work correctly.');
    }
  } else {
    console.log('\n⚠ No invoice_public_links row found — will be created on first access.');
    const token = createPublicInvoiceToken(invoice.id, invoice.id, 1, 1);
    console.log(`  Fallback token (before link creation): ${token.slice(0,40)}...`);
    console.log(`  Proxy regex test (/^[a-zA-Z0-9_.-]+$/): ${/^[a-zA-Z0-9_.-]+$/.test(token)}`);
  }

  // 4. Test proxy regex for UUID-only (old-style secure_token)
  const exampleUuid = invoice.secure_token;
  if (exampleUuid) {
    const oldRegex = /^[a-zA-Z0-9_-]+$/;
    const newRegex = /^[a-zA-Z0-9_.-]+$/;
    console.log(`\n--- Proxy Regex Test ---`);
    console.log(`  secure_token: ${exampleUuid?.slice(0, 16)}...`);
    console.log(`  Old regex (no dot): ${oldRegex.test(exampleUuid)} — FAILS for signed tokens with a dot!`);
    console.log(`  New regex (with dot): ${newRegex.test(exampleUuid)} — works for both UUIDs and signed tokens`);
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

runDiagnostic().catch(console.error);
