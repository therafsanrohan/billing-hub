# Cloud Migration & Database Persistence Audit Report

**Application**: Corevow Billing Hub V1 (`app-billing-hub-v1`)  
**Deployment**: Vercel (`app-web.vercel.app`)  
**Audit Date**: July 23, 2026  

---

## 1. Detected localStorage Keys
The codebase uses `localStore` (a wrapper around `localStorage`) in `src/lib/db.ts` with the key prefix `billing_hub_*`:
- `billing_hub_current_user`
- `billing_hub_profiles`
- `billing_hub_entities`
- `billing_hub_bank_accounts`
- `billing_hub_clients`
- `billing_hub_invoices`
- `billing_hub_items`
- `billing_hub_snapshots`
- `billing_hub_payments`
- `billing_hub_expenses`
- `billing_hub_tax_payments`
- `billing_hub_email_logs`
- `billing_hub_audit_logs`
- `billing_hub_vat_configurations`
- `billing_hub_vat_documents`
- `billing_hub_input_vat`
- `billing_hub_vat_returns`
- `billing_hub_reserve_settings`
- `billing_hub_reserve_ledger`
- `billing_hub_fdr_accounts`
- `billing_hub_dps_accounts`
- `billing_hub_dps_installments`
- `billing_hub_withdrawal_requests`
- `billing_hub_financial_audit_logs`
- `billing_seq_*` (Invoice & Receipt sequence counters)

---

## 2. Files Using Browser Storage
- `src/lib/db.ts`: Contains the `LocalStore` class that executes `localStorage.getItem` and `localStorage.setItem`.
- `src/app/billing/layout.tsx`: Reads/clears `billing_hub_current_user`.
- `src/app/login/page.tsx`: Reads/writes local user profile state.

---

## 3. Pages Using Main `db` Object
All billing pages directly or indirectly query `db` from `src/lib/db.ts`:
- `/src/app/billing/page.tsx` (Dashboard)
- `/src/app/billing/clients/page.tsx` & `[id]/page.tsx`
- `/src/app/billing/invoices/page.tsx` & `[id]/page.tsx`
- `/src/app/billing/payments/page.tsx`
- `/src/app/billing/expenses/page.tsx`
- `/src/app/billing/tax/page.tsx`
- `/src/app/billing/reserve/page.tsx`
- `/src/app/billing/team/page.tsx`
- `/src/app/billing/settings/entities/page.tsx`
- `/src/app/billing/settings/gateway-rates/page.tsx`

---

## 4. Existing Supabase Client Files
- `src/lib/supabase.ts`: Simple single client created via `@supabase/supabase-js`.
- **Target Architecture**: Standardize with Next.js `@supabase/ssr` helpers:
  - `src/lib/supabase/client.ts` (Browser client using `createBrowserClient`)
  - `src/lib/supabase/server.ts` (Server client using `createServerClient` and cookies)
  - `src/lib/supabase/admin.ts` (Server-only admin client with `import 'server-only'`)
  - `src/lib/supabase/middleware.ts` (Session refresh middleware)

---

## 5. Existing Database Service Files
- `src/lib/services/authService.ts`
- `src/lib/services/clientService.ts`
- `src/lib/services/paymentService.ts`

---

## 6. Existing Authentication Flow
- Currently relies on `localStore.currentUser` and demo quick login buttons on `/login`.
- **Required Fix**: Replace with Supabase Auth (`supabase.auth.signInWithPassword`, `supabase.auth.signOut`, cookie-based server session validation via Next.js Middleware).

---

## 7. Role & Permission Flow
- Roles: `Super Admin`, `Admin`, `Finance Admin` (or `Finance`), `Client Service`, `Project Manager`.
- Standardized database check constraint values: `super_admin`, `admin`, `finance`, `client_service`, `project_manager`, `viewer`.
- Display name mapping maintained seamlessly across UI and RLS.

---

## 8. Existing Migrations Sequence
1. `20260721000000_initial_schema.sql`
2. `20260721000001_functions_and_policies.sql`
3. `20260722000000_vat_and_tax_tables.sql`
4. `20260723000000_company_reserve_and_savings.sql`
5. `20260724000000_cloud_migration_functions_and_rls.sql`
6. **[NEW Corrective Migration]**: `20260725000000_fix_cloud_persistence_and_auth.sql`

---

## 9. Schema and TypeScript Mismatches
- Frontend generated legacy IDs as `cli-${Date.now()}` or `pay-${Date.now()}`, whereas PostgreSQL columns expect `UUID` (`gen_random_uuid()`).
- **Fix**: Standardize all ID generators to use valid `crypto.randomUUID()` when creating new cloud records.

---

## 10. Missing Environment Variables
- Required Public:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Required Server-only:
  - `SUPABASE_SERVICE_ROLE_KEY`

---

## 11. Risks of Data Loss
- Existing browser `localStorage` contains real operational client and invoice data.
- **Safety Measure**: Never wipe `localStorage` automatically. Keep `/billing/admin/migrate` tool active for Super Admins to backup and migrate records to Supabase.

---

## 12. Implementation Order
1. Setup `@supabase/ssr` clients (`client.ts`, `server.ts`, `admin.ts`, `middleware.ts`).
2. Add Next.js Middleware for cookie session protection on `/billing` routes.
3. Add corrective database migration `20260725000000_fix_cloud_persistence_and_auth.sql`.
4. Refactor `src/lib/db.ts` to query Supabase Cloud Database directly (disabling silent `LocalStore` fallbacks in production).
5. Fix ID formatters to generate valid UUIDs (`crypto.randomUUID()`).
6. Remove Developer Sandbox Quick Login in Production.
7. Update Documentation (`README.md`, `SETUP_GUIDE.md`, `DEPLOYMENT_AND_BACKUP.md`).
8. Verify `npm run build` passes with zero errors.
