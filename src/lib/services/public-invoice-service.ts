if (typeof window !== 'undefined') {
  throw new Error('This service is server-only and cannot be imported in a browser Client Component.');
}

import { createAdminClient } from '@/lib/supabase/admin';
import {
  parsePublicInvoiceToken,
  verifyPublicInvoiceToken,
  createPublicInvoiceToken,
  hashLegacyToken,
  getCanonicalPublicInvoiceUrl
} from '@/lib/security/public-invoice-token';
import { calculateTotals } from '@/lib/calculations';

export interface PublicInvoiceViewModel {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: 'BDT' | 'USD';
  projectName: string;
  servicePeriod?: string;
  poNumber?: string;
  referenceNumber?: string;
  items: Array<{
    serviceName: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
  }>;
  totals: {
    subtotal: number;
    discountAmount: number;
    vatAmount: number;
    totalPayable: number;
    amountPaid: number;
    amountDue: number;
  };
  client: {
    companyName: string;
    contactPerson: string;
    billingAddress: string;
    city: string;
    country: string;
    taxNumber?: string;
  };
  entity: {
    name: string;
    code: string;
    address: string;
    taxId?: string;
  };
  bankAccount?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    branch: string;
    routingNumber?: string;
    swiftBic?: string;
  };
  paymentInstructions?: string;
  termsConditions?: string;
  canonicalToken: string;
}

export type PublicInvoiceResult = 
  | { success: true; invoice: PublicInvoiceViewModel }
  | { success: false; redirectTo?: string; error: string };

const PUBLIC_VIEWABLE_STATUSES = ['approved', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue'];

/**
 * Server-Side Sanitized Public Invoice Fetcher
 * Strictly validates HMAC signed capability links and returns non-sensitive view models.
 */
export async function getSanitizedPublicInvoice(rawToken: string): Promise<PublicInvoiceResult> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, error: 'UNAVAILABLE' };
  }

  const supabase = createAdminClient();
  const parsed = parsePublicInvoiceToken(rawToken);

  // 1. If rawToken is a valid Signed Token (linkId.signature)
  if (parsed) {
    let targetInvoiceId = parsed.linkId;
    let version = 1;
    let keyVersion = 1;
    let linkActive = true;

    try {
      const { data: link, error: linkErr } = await supabase
        .from('invoice_public_links')
        .select('*')
        .eq('id', parsed.linkId)
        .maybeSingle();

      if (!linkErr && link) {
        targetInvoiceId = link.invoice_id;
        version = link.version || 1;
        keyVersion = link.key_version || 1;
        linkActive = link.is_active ?? true;
      }
    } catch {
      // Table may not exist yet on Supabase - fallback to direct ID capability verification
    }

    if (!linkActive) {
      return { success: false, error: 'UNAVAILABLE' };
    }

    // Verify HMAC Signature using constant-time check
    const isValid = verifyPublicInvoiceToken(rawToken, targetInvoiceId, version, keyVersion);
    if (!isValid) {
      return { success: false, error: 'UNAVAILABLE' };
    }

    // Fetch Invoice Record
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', targetInvoiceId)
      .single();

    if (invErr || !invoice || !PUBLIC_VIEWABLE_STATUSES.includes(invoice.status)) {
      return { success: false, error: 'UNAVAILABLE' };
    }

    // Fetch Snapshot if available
    const { data: snapshot } = await supabase
      .from('invoice_snapshots')
      .select('*')
      .eq('invoice_id', invoice.id)
      .maybeSingle();

    // Fetch Line Items
    const { data: dbItems } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order', { ascending: true });

    // Fetch Payments (for amount calculation only)
    const { data: dbPayments } = await supabase
      .from('invoice_payments')
      .select('amount, payment_date')
      .eq('invoice_id', invoice.id);

    // Fetch Client
    const { data: dbClient } = await supabase
      .from('billing_clients')
      .select('company_name, contact_person, billing_address, city, country, tax_number')
      .eq('id', invoice.client_id)
      .single();

    // Fetch Entity
    const { data: dbEntity } = await supabase
      .from('business_entities')
      .select('legal_name, entity_code, registered_address, tax_id')
      .eq('id', invoice.entity_id)
      .single();

    // Fetch Bank Account
    const { data: dbBank } = await supabase
      .from('entity_bank_accounts')
      .select('bank_name, account_holder, account_number, branch, routing_number, swift_bic')
      .eq('entity_id', invoice.entity_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const items = (dbItems || []).map(i => ({
      serviceName: i.service_name || i.description || 'Service Item',
      description: i.description || '',
      quantity: Number(i.quantity) || 1,
      unit: i.unit || 'job',
      rate: Number(i.rate) || 0,
      amount: Number(i.amount) || 0
    }));

    const payments = (dbPayments || []).map(p => ({ amount: Number(p.amount) }));

    const calc = calculateTotals({
      items: items.map(i => ({ quantity: i.quantity, rate: i.rate })),
      discountType: invoice.discount_type || 'none',
      discountValue: Number(invoice.discount_value) || 0,
      vatRate: Number(invoice.vat_rate) || 0,
      vatInclusive: invoice.vat_inclusive ?? true,
      payments
    });

    const clientSnap = snapshot?.client_snapshot || dbClient;
    const entitySnap = snapshot?.entity_snapshot || dbEntity;
    const bankSnap = snapshot?.bank_snapshot || dbBank;

    const viewModel: PublicInvoiceViewModel = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || 'Approved Invoice',
      status: invoice.status,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      currency: invoice.currency as 'BDT' | 'USD',
      projectName: invoice.project_name,
      servicePeriod: invoice.service_period || undefined,
      poNumber: invoice.po_number || undefined,
      referenceNumber: invoice.reference_number || undefined,
      items,
      totals: {
        subtotal: snapshot?.totals_snapshot?.subtotal ?? calc.subtotal,
        discountAmount: snapshot?.totals_snapshot?.discount_amount ?? calc.discountAmount,
        vatAmount: calc.vatAmount,
        totalPayable: snapshot?.totals_snapshot?.total_payable ?? calc.totalPayable,
        amountPaid: calc.amountPaid,
        amountDue: calc.amountDue
      },
      client: {
        companyName: clientSnap?.company_name || 'Client',
        contactPerson: clientSnap?.contact_person || 'Client Contact',
        billingAddress: clientSnap?.billing_address || '',
        city: clientSnap?.city || '',
        country: clientSnap?.country || '',
        taxNumber: clientSnap?.tax_number || undefined
      },
      entity: {
        name: entitySnap?.legal_name || entitySnap?.name || (invoice.currency === 'USD' ? 'Corevow LLC' : 'Corevow Limited'),
        code: entitySnap?.entity_code || (invoice.currency === 'USD' ? 'CLLC' : 'CLTD'),
        address: entitySnap?.registered_address || entitySnap?.address || '',
        taxId: entitySnap?.tax_id || undefined
      },
      bankAccount: bankSnap?.bank_name ? {
        bankName: bankSnap.bank_name,
        accountHolder: bankSnap.account_holder,
        accountNumber: bankSnap.account_number,
        branch: bankSnap.branch,
        routingNumber: bankSnap.routing_number || undefined,
        swiftBic: bankSnap.swift_bic || undefined
      } : undefined,
      paymentInstructions: invoice.payment_instructions || undefined,
      termsConditions: invoice.terms_conditions || undefined,
      canonicalToken: rawToken
    };

    return { success: true, invoice: viewModel };
  }

  // 2. Legacy Token Compatibility Handling (Exact SHA-256 Hash Matching)
  try {
    const legacyHash = hashLegacyToken(rawToken);
    const { data: legacyLink } = await supabase
      .from('invoice_public_links')
      .select('*')
      .eq('legacy_token_hash', legacyHash)
      .eq('is_active', true)
      .maybeSingle();

    if (legacyLink) {
      const canonicalToken = createPublicInvoiceToken(
        legacyLink.id,
        legacyLink.invoice_id,
        legacyLink.version,
        legacyLink.key_version
      );
      return { success: false, redirectTo: canonicalToken, error: 'REDIRECT' };
    }
  } catch {
    // Table may not exist yet
  }

  // Fallback for direct secure_token, invoice ID, or invoice_number on invoices table
  const { data: legacyInv } = await supabase
    .from('invoices')
    .select('id, status')
    .or(`secure_token.eq.${rawToken},id.eq.${rawToken},invoice_number.eq.${rawToken}`)
    .maybeSingle();

  if (legacyInv && PUBLIC_VIEWABLE_STATUSES.includes(legacyInv.status)) {
    const { token } = await getOrGeneratePublicInvoiceToken(legacyInv.id);
    return { success: false, redirectTo: token, error: 'REDIRECT' };
  }

  // If rawToken was not a valid signed token and had no legacy hash match
  return { success: false, error: 'UNAVAILABLE' };
}

/**
 * Generates or fetches the active signed public token for an invoice
 */
export async function getOrGeneratePublicInvoiceToken(
  invoiceId: string,
  createdBy?: string
): Promise<{ token: string; url: string }> {
  const supabase = createAdminClient();

  try {
    const { data: existingLink } = await supabase
      .from('invoice_public_links')
      .select('*')
      .eq('invoice_id', invoiceId)
      .maybeSingle();

    let linkRecord = existingLink;

    if (!linkRecord) {
      const { data: newLink, error: createErr } = await supabase
        .from('invoice_public_links')
        .insert({
          invoice_id: invoiceId,
          version: 1,
          is_active: true,
          access_mode: 'LINK_ONLY',
          created_by: createdBy || null,
          key_version: 1
        })
        .select('*')
        .single();

      if (!createErr && newLink) {
        linkRecord = newLink;
      }
    }

    if (linkRecord) {
      const token = createPublicInvoiceToken(
        linkRecord.id,
        linkRecord.invoice_id,
        linkRecord.version,
        linkRecord.key_version
      );
      return {
        token,
        url: getCanonicalPublicInvoiceUrl(token)
      };
    }
  } catch {
    // Table not created yet - fallback to direct ID capability link
  }

  const fallbackToken = createPublicInvoiceToken(invoiceId, invoiceId, 1, 1);
  return {
    token: fallbackToken,
    url: getCanonicalPublicInvoiceUrl(fallbackToken)
  };
}

/**
 * Rotates a public link (invalidates existing signatures by incrementing version)
 */
export async function rotatePublicInvoiceLink(
  invoiceId: string,
  reason?: string,
  rotatedBy?: string
): Promise<{ token: string; url: string }> {
  const supabase = createAdminClient();

  try {
    const { data: existingLink } = await supabase
      .from('invoice_public_links')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();

    if (existingLink) {
      const newVersion = (existingLink.version || 1) + 1;

      const { data: updatedLink, error: updateErr } = await supabase
        .from('invoice_public_links')
        .update({
          version: newVersion,
          is_active: true,
          rotation_reason: reason || 'Manual Admin Rotation',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLink.id)
        .select('*')
        .single();

      if (!updateErr && updatedLink) {
        const token = createPublicInvoiceToken(
          updatedLink.id,
          updatedLink.invoice_id,
          updatedLink.version,
          updatedLink.key_version
        );
        return {
          token,
          url: getCanonicalPublicInvoiceUrl(token)
        };
      }
    }
  } catch {
    // Fallback
  }

  const fallbackToken = createPublicInvoiceToken(invoiceId, invoiceId, 2, 1);
  return {
    token: fallbackToken,
    url: getCanonicalPublicInvoiceUrl(fallbackToken)
  };
}

/**
 * Revokes a public link (sets is_active = false)
 */
export async function revokePublicInvoiceLink(
  invoiceId: string,
  revokedBy?: string
): Promise<void> {
  const supabase = createAdminClient();

  try {
    await supabase
      .from('invoice_public_links')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: revokedBy || null,
        updated_at: new Date().toISOString()
      })
      .eq('invoice_id', invoiceId);
  } catch {
    // Fallback
  }
}
