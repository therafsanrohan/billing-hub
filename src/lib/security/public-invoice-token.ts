/**
 * Server-Only Cryptographic HMAC Public Invoice Token Security Module
 * Enforces tamper-proof, unguessable capability links for public invoice access.
 */

if (typeof window !== 'undefined') {
  throw new Error('This module is server-only and cannot be imported in a browser Client Component.');
}

import crypto from 'crypto';

const DEFAULT_SIGNING_SECRET = process.env.PUBLIC_INVOICE_SIGNING_SECRET || 
  process.env.SUPABASE_SECRET_KEY || 
  'app_secure_public_invoice_hmac_secret_key_2026_v1_prod_safe';

function getSigningSecret(): string {
  const secret = process.env.PUBLIC_INVOICE_SIGNING_SECRET || DEFAULT_SIGNING_SECRET;
  return secret;
}

/**
 * Generates an HMAC-SHA256 signature for a public invoice link
 */
export function computeLinkSignature(
  linkId: string,
  invoiceId: string,
  version: number = 1,
  keyVersion: number = 1
): string {
  const secret = getSigningSecret();
  const canonicalData = `${linkId}:${invoiceId}:${version}:${keyVersion}`;
  return crypto
    .createHmac('sha256', secret)
    .update(canonicalData)
    .digest('hex');
}

/**
 * Creates a signed public invoice capability token: `${linkId}.${signature}`
 */
export function createPublicInvoiceToken(
  linkId: string,
  invoiceId: string,
  version: number = 1,
  keyVersion: number = 1
): string {
  const signature = computeLinkSignature(linkId, invoiceId, version, keyVersion);
  return `${linkId}.${signature}`;
}

/**
 * Parses a public invoice token into its linkId and signature components
 */
export function parsePublicInvoiceToken(token: string): { linkId: string; signature: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [linkId, signature] = parts;
  if (!linkId || !signature || signature.length !== 64) return null;
  return { linkId, signature };
}

/**
 * Verifies token signature using constant-time comparison
 */
export function verifyPublicInvoiceToken(
  token: string,
  invoiceId: string,
  version: number = 1,
  keyVersion: number = 1
): boolean {
  const parsed = parsePublicInvoiceToken(token);
  if (!parsed) return false;

  const expectedSignature = computeLinkSignature(parsed.linkId, invoiceId, version, keyVersion);
  
  try {
    const sigBuffer = Buffer.from(parsed.signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Computes SHA-256 hash for legacy secure_token lookup
 */
export function hashLegacyToken(legacyToken: string): string {
  return crypto.createHash('sha256').update(legacyToken.trim()).digest('hex');
}

/**
 * Resolves the canonical public URL for an invoice link
 */
export function getCanonicalPublicInvoiceUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (typeof window !== 'undefined' ? window.location.origin : 'https://app-web.vercel.app');
  return `${baseUrl.replace(/\/$/, '')}/invoice/${token}`;
}
