# Cloud SaaS Migration Audit & System Blueprint

**Repository:** `app_web`  
**Application Directory:** `app-billing-hub-v1`  
**Audit Date:** July 23, 2026  
**Auditor:** Lead Full-Stack Engineer, PostgreSQL Architect & AppSec Engineer  

---

## 1. Current Framework and Architecture
- **Framework:** Next.js 16 (App Router with Turbopack).
- **Language:** TypeScript (`strict: true`).
- **Database & Backend:** Supabase PostgreSQL with `@supabase/ssr` (v0.5.2) and `@supabase/supabase-js`.
- **Styling:** Vanilla CSS & TailwindCSS utility classes for dynamic glassmorphism and modern UI.
- **Current State:** The database layer (`src/lib/db.ts` & `src/lib/services/`) was historically hybrid—falling back to `LocalStore` or `localStorage` when cloud queries failed or when sequence numbers were generated. Auth was partially mocked using hardcoded local user profiles.

---

## 2. All `localStorage` / `sessionStorage` Keys Identified
1. `billing_hub_current_user`: Saved mock user profile object.
2. `app_session_uid`: Saved session user ID for mock fallback auth.
3. `billing_seq_{entityPrefix}_{year}`: Local sequence counter for invoice and receipt numbers (e.g. `billing_seq_CLTD_2026`).
4. UI display preferences (Allowed): Theme, sidebar toggle state.

---

## 3. Every Browser-Storage File
- `src/lib/services/authService.ts`: Reads/writes `billing_hub_current_user`.
- `src/lib/db.ts`: Contains sequence key fallbacks accessing `localStorage.getItem` / `localStorage.setItem`.
- `src/app/billing/admin/migrate/page.tsx`: Reads `localStorage` for migration to Supabase.
- `src/app/login/page.tsx`: Quick login buttons assigning local session storage.

---

## 4. LocalStore Implementation
- Previously present in `src/lib/db.ts` as `class LocalStore` holding in-memory mock data arrays (`MOCK_VAT_*`, `mockInvoices`, etc.).
- **Action Required:** Purge all residual mock array fallbacks and replace all `db` and service operations with strict Supabase calls.

---

## 5. Pages Depending on Local Data
- `/billing/admin/migrate`: Migration dashboard (scanning local storage keys).
- `/billing/reserve`: Had hardcoded `ent-1` / `ent-2` select option values (recently updated to dynamic entities).
- `/login`: Had Developer Quick Login bypassing Supabase Auth.

---

## 6. Existing Supabase Clients
- `src/lib/supabase.ts`: Client component wrapper using `createBrowserClient`.
- `src/lib/supabase/client.ts`: Standard browser client creator using `@supabase/ssr`.
- **Missing:** `src/lib/supabase/server.ts` (Cookie-based server client for Next.js App Router Server Components / Actions / Middleware) and `src/lib/supabase/admin.ts` (Service role client strictly guarded by `import 'server-only'`).

---

## 7. Existing Database Services
- `src/lib/services/authService.ts`
- `src/lib/services/invoiceService.ts`
- `src/lib/services/clientService.ts`
- `src/lib/services/vatService.ts`
- `src/lib/services/reserveService.ts`
- **Action Required:** Standardize all service files under `src/lib/services/` (`auth-service.ts`, `profile-service.ts`, `client-service.ts`, `project-service.ts`, `quotation-service.ts`, `invoice-service.ts`, `payment-service.ts`, `expense-service.ts`, `reserve-service.ts`, `investment-service.ts`, `tax-service.ts`, `report-service.ts`, `settings-service.ts`, `audit-service.ts`) ensuring 100% cloud execution.

---

## 8. Existing Authentication Flow
- Mixed: Supabase Auth exists in migrations, but frontend had fallback session keys stored in browser `localStorage` and `authService.ts`.
- **Correction:** Enforce 100% Supabase Auth with `@supabase/ssr` cookies and Next.js `middleware.ts` protecting `/billing/*` server-side.

---

## 9. Existing Role System & Inconsistencies
- Roles were inconsistently named across string literals (`Super Admin`, `super_admin`, `super-admin`, `Finance`, `finance_admin`).
- **Canonical Stored Roles:**
  - `super_admin` (Display: "Super Admin")
  - `admin` (Display: "Admin")
  - `finance` (Display: "Finance Department")
  - `client_service` (Display: "Client Service")
  - `project_manager` (Display: "Project Manager")
  - `viewer` (Display: "Viewer")

---

## 10. Existing Database Migrations
- `20260721000000_initial_schema.sql`
- `20260721000001_functions_and_policies.sql`
- `20260722000000_vat_and_tax_tables.sql`
- `20260723000000_company_reserve_and_savings.sql`
- `20260724000000_cloud_migration_functions_and_rls.sql`
- `20260725000000_fix_cloud_persistence_and_auth.sql`
- `20260726000000_fix_all_rls_recursion.sql`
- `20260727000000_missing_tables.sql`

---

## 11. Schema & Multitenancy Gaps
- `organizations` table exists, but several business tables lacked `organization_id` foreign keys or RLS helper functions.
- Missing an atomic PostgreSQL RPC function for payment recording with 20% automatic reserve allocation, rollback handling, and audit logging.

---

## 12. UUID & ID Format Consistency
- High risk of legacy mock strings (`ent-1`, `usr-1`) in user data causing Postgres `invalid input syntax for type uuid`.
- **Resolution:** All primary keys strictly default to `gen_random_uuid()`. Human readable numbers (e.g. `CLTD-BDT-2026-0001`) stored in separate columns (`invoice_number`, `client_code`).

---

## 13. Environment-Variable Audit
- `NEXT_PUBLIC_SUPABASE_URL` (Required)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Required)
- `SUPABASE_SERVICE_ROLE_KEY` (Server-only, optional for admin tasks)
- `ENABLE_DEV_SANDBOX_LOGIN` (Server-side flag, defaults to `false` in production)

---

## 14. Production Security & Data Loss Risks
- **Data Isolation Risk:** Without enforced RLS policies using `current_user_organization_id()`, multi-tenant data leakage can occur across organizations.
- **Confidential Financial Risk:** Reserve, FDR, and DPS tables could be queried by unauthorized roles (`project_manager`, `viewer`) if RLS policies are not strictly restricted to `super_admin`, `admin`, `finance`.
- **Atomic Transaction Risk:** Creating payment and reserve allocation in separate frontend calls can leave partial records if network drops midway.

---

## 15. Correct Implementation Order
1. **Migration File Creation:** `supabase/migrations/20260728000000_fix_saas_cloud_persistence.sql` containing multitenancy schema, canonical roles, confidential financial RLS, 20% atomic reserve RPC `record_payment_and_allocate_reserve`, FDR/DPS tables, audit log triggers.
2. **Supabase SSR Infrastructure:** Build `client.ts`, `server.ts`, `admin.ts` and Next.js `middleware.ts`.
3. **Services Layer Refactoring:** Modularize all CRUD operations in `src/lib/services/` and update `src/lib/db.ts` to bridge existing UI calls cleanly.
4. **Auth & Route Guarding:** Secure `/login`, `/billing/*` using SSR sessions and Supabase Auth.
5. **Legacy Cloud Migration Route:** Implement `/billing/settings/cloud-migration` and alias `/billing/admin/migrate`.
6. **Tests & Build Verification:** Write test suites in `tests/`, verify `npx tsc --noEmit`, `npm run build`, and confirm cross-device cloud persistence.
