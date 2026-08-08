# Supabase Persistence Repair Audit

## Phase 1: Deployed Version & Environment Verification

- **Git Branch:** `fix/complete-supabase-persistence`
- **Latest Commit HEAD:** `d8cdb62` (`fix: centralize Supabase configuration, distinguish network connectivity errors, add health API and system diagnostics`)
- **Primary Application Directory:** `app-billing-hub-v1`
- **Vercel Root Directory:** `app-billing-hub-v1`
- **Live Application URL:** `https://app-web.vercel.app/`
- **Audit Date:** 2026-07-23

---

## Phase 2: Persistence Audit Findings

### 1. Hard-Coded Fallbacks & Empty Cloud Result Pattern
- **Issue:** Several functions in `src/lib/db.ts` checked `if (!error && data && data.length > 0)` before returning data. If Supabase returned `[]` (an empty array), the code falsely fell back to returning `localStore` records or static mock data.
- **Correction:** Removed `data.length > 0` conditions. An empty query result (`[]`) from Supabase is treated as a valid response. No fallback mock data will be served in production.

### 2. LocalStore Writes & Fallbacks
- **Issue:** LocalStore fallback writes existed across entity, bank account, client, invoice, expense, and tax handlers.
- **Correction:** Production business operations write directly and exclusively to Supabase PostgreSQL.

### 3. Username Login & Client-Side Profiles Lookup
- **Issue:** Unauthenticated browser executed `db.getProfiles()` to resolve usernames.
- **Correction:** Refactored login to use a secure server-side action (`/api/auth/login`) with generic credential error handling and server-side username resolution.

### 4. Database Migrations & RLS
- **Issue:** Consolidated all SQL migrations into `supabase/migrations/20260730000000_complete_cloud_persistence_repair.sql`.
- **Correction:** Enforced RLS across `entity_bank_accounts`, `invoices`, `payments`, `reserve_ledger`, `fdr_records`, `dps_records`, `tax_payments`, `gateway_rates`, and `billing_audit_logs`.
