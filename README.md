# Corevow Billing Hub V1 — Cloud SaaS Platform

Corevow Billing Hub V1 is a multi-tenant, cloud-native SaaS platform built for financial management, corporate billing, 20% automated emergency reserve allocation, FDR/DPS investment tracking, and tax/VAT compliance across **Corevow Limited** (Bangladesh / BDT) and **Corevow LLC** (United States / USD).

---

## 🌟 Core Architecture & Capabilities

### 1. 100% Cloud-Native Database Architecture
- **Supabase PostgreSQL Single Source of Truth**: All organization data (invoices, payments, clients, reserve, FDR, DPS, tax, audit logs) is stored in Supabase PostgreSQL.
- **Zero Browser Caching**: No business data is saved to or read from `localStorage`, `sessionStorage`, or in-memory mock stores.
- **Cross-Device Sync**: Any data created on desktop instantly appears on mobile, tablet, and across all authorized browser sessions.

### 2. Multi-Entity Corporate Billing & Atomic Reserve
- **Dual Entity Management**: Support for **Corevow Limited (CLTD - BDT)** and **Corevow LLC (CLLC - USD)**.
- **Atomic 20% Reserve Allocation**: Automated PostgreSQL RPC transaction (`record_payment_and_allocate_reserve`) splits incoming payments into 20% emergency reserve and 80% operating cash.
- **FDR & DPS Investment Tracking**: Managed internal asset transfers with strict Row Level Security (RLS).

### 3. Canonical Role-Based Access Control (RBAC) & Confidential Financial Access
- **Canonical Roles**: `super_admin`, `admin`, `finance`, `client_service`, `project_manager`, `viewer`.
- **Confidential Module Security**: Reserve balances, FDR accounts, DPS records, and company savings are strictly guarded by PostgreSQL RLS policies and accessible only to `super_admin`, `admin`, and `finance`.

---

## 🌐 Server Routing & Access URLs

- **Main Dashboard / Entry URL**: `https://billing.app.com` or `https://app.com/billing` (path `/billing`).
- **Server-Side Session Guard**: Unauthenticated requests to `/billing/*` are redirected to `/login` via Next.js SSR middleware (`src/middleware.ts`).
- **Public Client Invoice View**: `https://your-domain.com/invoice/[secureToken]`.
- **Super Admin Cloud Migration Route**: `/billing/settings/cloud-migration` (Reconcile & import legacy backups).

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Database & Auth**: Supabase PostgreSQL + `@supabase/ssr` + Supabase Auth
- **Styling**: Vanilla CSS + TailwindCSS 4
- **Icons**: Lucide React
- **PDF & Export**: `html2pdf.js`

---

## 🚀 Quick Setup & Deployment

See:
- [SETUP_GUIDE.md](SETUP_GUIDE.md) — Step-by-step local setup & Super Admin creation.
- [DEPLOYMENT_AND_BACKUP.md](DEPLOYMENT_AND_BACKUP.md) — Vercel deployment, database backups, and rollback procedures.
- [CLOUD_SAAS_MIGRATION_AUDIT.md](CLOUD_SAAS_MIGRATION_AUDIT.md) — Technical migration audit blueprint.
