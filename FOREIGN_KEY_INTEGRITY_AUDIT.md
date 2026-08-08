# Foreign Key Integrity Audit

**Application:** Corevow Billing Hub V1 (`app-billing-hub-v1`)  
**Audit Date:** July 23, 2026  
**Auditor:** Antigravity AI (Lead PostgreSQL & Next.js Architect)

---

## 📊 Comprehensive Foreign Key Inventory

| Child Table | Child Column | Parent Table | Parent Column | Required/Nullable | Delete Behavior | Application Page / Service | Risk Level | Validation Required |
|---|---|---|---|---|---|---|---|---|
| `invoices` | `entity_id` | `business_entities` | `id` | Required | CASCADE | `/billing/invoices/new`, `db.createInvoice` | HIGH | UUID check, Entity existence, Currency match |
| `invoices` | `client_id` | `clients` | `id` | Required | RESTRICT | `/billing/invoices/new`, `db.createInvoice` | HIGH | UUID check, Client existence |
| `invoices` | `created_by` | `profiles` | `id` | Required | RESTRICT | System-wide invoice creation | MEDIUM | UUID check, Profile active state |
| `invoices` | `account_manager_id` | `profiles` | `id` | Nullable | SET NULL | `/billing/invoices/new` | LOW | Nullify empty string, Profile existence |
| `invoices` | `organization_id` | `organizations` | `id` | Required | RESTRICT | Multi-tenant isolation | HIGH | Org ownership match |
| `invoice_items` | `invoice_id` | `invoices` | `id` | Required | CASCADE | `db.createInvoice`, `invoice_items` | HIGH | Atomic transaction |
| `payments` | `invoice_id` | `invoices` | `id` | Required | CASCADE | `/billing/payments`, `paymentService` | HIGH | Invoice status check, Amount due check |
| `payments` | `recorded_by` | `profiles` | `id` | Required | RESTRICT | `paymentService` | MEDIUM | Auth user ID check |
| `payments` | `client_id` | `clients` | `id` | Nullable | SET NULL | `/billing/payments` | LOW | Nullify empty string |
| `receipts` | `payment_id` | `payments` | `id` | Required | CASCADE | `/billing/receipts/[id]` | HIGH | Payment existence |
| `expenses` | `entity_id` | `business_entities` | `id` | Required | CASCADE | `/billing/expenses`, `db.addExpense` | HIGH | Entity existence |
| `expenses` | `recorded_by` | `profiles` | `id` | Required | RESTRICT | `db.addExpense` | MEDIUM | Auth user ID check |
| `expenses` | `bank_account_id` | `entity_bank_accounts` | `id` | Nullable | SET NULL | `/billing/expenses` | LOW | Nullify empty string |
| `reserve_ledger` | `entity_id` | `business_entities` | `id` | Required | CASCADE | `/billing/reserve`, `paymentService` | HIGH | Entity existence |
| `reserve_ledger` | `invoice_id` | `invoices` | `id` | Nullable | SET NULL | 20% Reserve Allocation RPC | MEDIUM | Nullify empty string |
| `reserve_ledger` | `payment_id` | `payments` | `id` | Nullable | SET NULL | 20% Reserve Allocation RPC | MEDIUM | Nullify empty string |
| `fdr_records` | `entity_id` | `business_entities` | `id` | Required | CASCADE | `/billing/reserve`, `investmentService` | HIGH | Entity existence, Role permission |
| `fdr_records` | `funding_account_id` | `entity_bank_accounts` | `id` | Nullable | SET NULL | `investmentService` | LOW | Nullify empty string |
| `dps_records` | `entity_id` | `business_entities` | `id` | Required | CASCADE | `/billing/reserve`, `investmentService` | HIGH | Entity existence, Role permission |
| `dps_records` | `funding_account_id` | `entity_bank_accounts` | `id` | Nullable | SET NULL | `investmentService` | LOW | Nullify empty string |
| `dps_installments` | `dps_id` | `dps_records` | `id` | Required | CASCADE | `investmentService` | HIGH | Parent DPS existence |
| `entity_bank_accounts` | `entity_id` | `business_entities` | `id` | Required | CASCADE | `/billing/settings/entities` | HIGH | Entity existence |
| `projects` | `client_id` | `clients` | `id` | Required | CASCADE | `/billing/clients/[id]` | MEDIUM | Client existence |
| `quotations` | `client_id` | `clients` | `id` | Required | CASCADE | Quotation workflows | MEDIUM | Client existence |
| `quotations` | `entity_id` | `business_entities` | `id` | Required | CASCADE | Quotation workflows | MEDIUM | Entity existence |
| `quotation_items` | `quotation_id` | `quotations` | `id` | Required | CASCADE | Quotation workflows | HIGH | Parent quotation existence |
| `vat_audit_logs` | `entity_id` | `business_entities` | `id` | Required | CASCADE | `/billing/tax` | MEDIUM | Entity existence |
| `audit_logs` | `user_id` | `profiles` | `id` | Required | RESTRICT | `auditService` | MEDIUM | User profile existence |

---

## 🛠️ Key Corrective Actions
1. **UUID Standardization:** Replaced all string/mock IDs (`ent-1`, `cli-1`, `usr-1`) with 36-character standard UUID v4 format.
2. **Nullable Field Sanitization:** Replaced empty string `""` values with explicit `null` for optional UUID columns (`account_manager_id`, `bank_account_id`, `vendor_id`).
3. **Atomic Writes:** Wrapped multi-table creation operations (e.g. `invoices` + `invoice_items`, `payments` + `reserve_ledger`) in PostgreSQL atomic RPC transactions to avoid partial inserts.
4. **Live Dropdown Fetching:** Updated UI components to populate entity, client, and manager selections directly from Supabase.
