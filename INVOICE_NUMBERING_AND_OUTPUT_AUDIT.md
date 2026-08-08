# INVOICE NUMBERING AND OUTPUT AUDIT REPORT

**Date:** 2026-07-23  
**Branch:** `fix/invoice-numbering-and-final-output`  
**Repository:** `https://github.com/therafsanrohan/app_web.git`  
**Application Directory:** `app-billing-hub-v1`  
**Live Application:** `https://app-web.vercel.app/`

---

## 1. Current Serial-Generation Flow & Vulnerabilities

### Current Application Implementation
The legacy serial generator in `src/lib/db.ts` executed during `approveInvoice`:
```ts
const allInvoices = await db.getInvoices();
const count = allInvoices.filter(i => i.invoice_number && i.invoice_number.startsWith(prefix)).length;
const nextNum = (count + 1).toString().padStart(4, '0');
const invoiceNumber = `${prefix}-${year}-${nextNum}`;
```

### Critical Flaws Identified
1. **Race Conditions & Concurrency Vulnerability:** Concurrent approvals read the same `allInvoices` count simultaneously and assign duplicate invoice numbers.
2. **Number Reuse on Record Deletion/Archive:** Deleting or archiving an invoice decreases `count`, causing the system to reuse an already-issued invoice serial number.
3. **RLS Scope Leak:** Row Level Security (RLS) filters hide rows for non-super-admin users, resulting in incorrect serial counts.
4. **Application-Side Non-Atomic Operations:** Reading count and writing invoice number occurs across multiple HTTP requests without table locking (`FOR UPDATE`).
5. **No Database Uniqueness Constraint:** `invoices.invoice_number` lacked a PostgreSQL `UNIQUE` constraint, permitting duplicate serials to persist in cloud storage.
6. **Incomplete Entity/Currency Separation:** Did not strictly tie `CLTD` (Corevow Limited / BDT) and `CLLC` (Corevow LLC / USD) to separate database counter sequences.

---

## 2. Current Invoice Approval & Finalization Flow

- Previously, approval updated status to `approved` and called `approveInvoice` in `src/lib/db.ts`.
- Snapshots (`invoice_snapshots`) were created partially on the client side, causing discrepancies when entity or client details changed later.
- Draft invoices were missing a strict internal `DRAFT` label, occasionally leaking placeholder numbers or internal UUIDs into public client views.

---

## 3. Current Public & Print Output Flow

- Public client page `/invoice/[secureToken]` was fetching separate table records from client components, creating flickering and missing snapshot data.
- Print output lacked a single canonical invoice document component, resulting in inconsistent margins and font sizes across internal preview, public link, print, and PDF downloads.

---

## 4. Git History Analysis & Last Known Good Commit

- **Last Known Good Commit:** `804300c` (`fix: optimize A4 print layout, paddings & html2canvas viewport width to fit exactly 1 page without text clipping`)
- **Key Trusted Visual Features to Restore:**
  - Standardized A4 container (`max-w-[210mm] w-full box-border`).
  - Header hierarchy with entity legal name, registration, tax/VAT ID, and address.
  - Billed To client card with contact person, billing address, and tax ID.
  - Line items table with exact unit rates, quantities, and exclusive/inclusive VAT flags.
  - Subtotal, discount, VAT status, total payable, amount paid, and balance due hierarchy.
  - Full-width remittance bank box (Bank Name, Account Holder, A/C Number, Branch, Routing, SWIFT/BIC) and mobile wallets (bKash/Nagad).
  - Authenticity QR verification badge.
  - Legal footer with BDT/USD specific VAT disclosures (`All rates are inclusive of applicable VAT in accordance with the prevailing laws and regulations of Bangladesh.`) and computer-generated document note.
  - Clean `@media print` CSS rules in `src/app/globals.css` with `@page { size: A4 portrait; margin: 6mm; }`.

---

## 5. Required Database Architecture Changes

1. **New Table:** `document_number_counters`
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `organization_id UUID`
   - `entity_id UUID NOT NULL REFERENCES business_entities(id)`
   - `document_type TEXT NOT NULL DEFAULT 'INVOICE'`
   - `period_key TEXT NOT NULL` (e.g. `2026`)
   - `prefix TEXT NOT NULL`
   - `last_number BIGINT NOT NULL DEFAULT 0`
   - `padding INTEGER NOT NULL DEFAULT 4`
   - `created_at TIMESTAMPTZ DEFAULT now()`
   - `updated_at TIMESTAMPTZ DEFAULT now()`
   - Unique constraint: `(organization_id, entity_id, document_type, period_key)`

2. **Database Constraint:**
   - Add `UNIQUE` constraint on `invoices(invoice_number)` (excluding NULL/drafts).

3. **Atomic RPC Function:** `finalize_invoice_and_assign_number(p_invoice_id UUID, p_user_id UUID)`
   - Locks invoice row (`FOR UPDATE`).
   - Validates invoice is in `pending_approval` or `draft` state and has no existing `invoice_number`.
   - Validates client, entity, and currency alignment (`BDT` -> `CLTD`, `USD` -> `CLLC`).
   - Locks counter row (`FOR UPDATE`), increments `last_number`, formats serial (`CLTD-INV-2026-0001`).
   - Updates invoice status to `approved`, assigns `invoice_number`, `approved_by`, `approved_at`.
   - Writes immutable snapshots into `invoice_snapshots`.
   - Returns approved invoice.

---

## 6. Target Architecture & Component Files

- **Database Migration:** `supabase/migrations/20260730000002_atomic_invoice_counter_and_finalization.sql`
- **Canonical Document:** `src/components/invoice/invoice-document.tsx`
- **ViewModel Types:** `src/components/invoice/invoice-document.types.ts`
- **Actions Bar:** `src/components/invoice/invoice-actions.tsx`
- **Print CSS:** `src/app/globals.css` (Restored A4 print rules)
- **Public Page:** `src/app/invoice/[secureToken]/page.tsx`
- **Internal Preview:** `src/app/billing/invoices/[id]/preview/page.tsx`
- **Internal Detail:** `src/app/billing/invoices/[id]/page.tsx`
- **PDF Streaming API:** `src/app/api/public/invoices/[secureToken]/pdf/route.ts` & `src/app/api/invoices/[id]/pdf/route.ts`
- **Serial Settings UI:** `src/app/billing/settings/invoice-numbering/page.tsx`

---

## 7. Risks & Safety Precautions
- **Existing Finalized Invoices:** Finalized invoices with valid numbers will NOT be renumbered.
- **RLS Safety:** Counter updates occur inside SECURITY DEFINER PostgreSQL RPC with explicit permission checks.
- **Database Backup:** Backup script executed prior to migration.
