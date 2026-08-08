# SYSTEM-WIDE ACTION COVERAGE MATRIX

This matrix audits all visible, interactive, and workflow actions across the **Corevow Billing Hub SaaS Application**.

---

## Module 1: Global Shell & Navigation

| Route | Page | Allowed Roles | Button / Action | Component File | Handler Function | Backend / DB Mutation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| All | Shell | All | Sidebar Links | `src/components/layout/sidebar.tsx` | Next Link | None | ✅ |
| All | Shell | All | Mobile Drawer Toggle | `src/components/layout/header.tsx` | `setMobileOpen` | Client State | ✅ |
| All | Shell | All | Notifications Bell | `src/components/layout/header.tsx` | Link to `/billing/inbox` | None | ✅ |
| All | Shell | All | User Logout | `src/components/layout/header.tsx` | `handleLogout` | Server Action / Auth SignOut | ✅ |

---

## Module 2: Clients Management

| Route | Page | Allowed Roles | Button / Action | Component File | Handler Function | Backend / DB Mutation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/billing/clients/new` | New Client | Super Admin, Admin, CS | Create Client | `src/app/billing/clients/new/page.tsx` | `handleSubmit` | `db.createClient` -> `billing_clients` | ✅ |
| `/billing/clients/[id]/edit` | Edit Client | Super Admin, Admin, CS | Save Client | `src/app/billing/clients/[id]/edit/page.tsx` | `handleSubmit` | `db.updateClient` -> `billing_clients` | ✅ |
| `/billing/clients` | Clients List | Super Admin, Admin, CS | Archive Client | `src/app/billing/clients/page.tsx` | `handleArchive` | `db.archiveClient` -> `billing_clients` | ✅ |

---

## Module 3: Invoices & Public Links

| Route | Page | Allowed Roles | Button / Action | Component File | Handler Function | Backend / DB Mutation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/billing/invoices/new` | New Invoice | Super Admin, Admin, CS, PM | Save Draft | `src/app/billing/invoices/new/page.tsx` | `handleSave('draft')` | `db.createInvoice` -> `invoices` | ✅ |
| `/billing/invoices/new` | New Invoice | Super Admin, Admin, CS, PM | Submit Approval | `src/app/billing/invoices/new/page.tsx` | `handleSave('pending_approval')` | `create_invoice_with_items` RPC | ✅ |
| `/billing/invoices/[id]` | Invoice View | Super Admin, Finance Admin | Approve Invoice | `src/app/billing/invoices/[id]/page.tsx` | `handleApprove` | `db.approveInvoice` -> `invoices` | ✅ |
| `/billing/invoices/[id]` | Invoice View | Super Admin, Finance Admin | Reject Invoice | `src/app/billing/invoices/[id]/page.tsx` | `handleReject` | `db.rejectInvoice` -> `invoices` | ✅ |
| `/billing/invoices/[id]` | Invoice View | Super Admin, Finance Admin, CS | Copy Public Link | `src/app/billing/invoices/[id]/page.tsx` | `handleCopyPublicLink` | `getPublicInvoiceUrl` | 🛠️ (Refactoring for HMAC) |
| `/billing/invoices/[id]` | Invoice View | Super Admin, Finance Admin, CS | Rotate Public Link | `src/app/billing/invoices/[id]/page.tsx` | `handleRotatePublicLink` | `rotatePublicInvoiceToken` | 🛠️ (Refactoring for HMAC) |
| `/billing/invoices/[id]` | Invoice View | Super Admin, Finance Admin | Revoke Public Link | `src/app/billing/invoices/[id]/page.tsx` | `handleRevokePublicLink` | `revokePublicInvoiceToken` | 🛠️ (Refactoring for HMAC) |
| `/invoice/[secureToken]` | Public Page | Public Client (No Auth) | Print Invoice | `src/app/invoice/[secureToken]/page.tsx` | `handlePrint` | Browser Print API | 🛠️ (Refactoring for Server Component) |
| `/invoice/[secureToken]` | Public Page | Public Client (No Auth) | Download PDF | `src/app/invoice/[secureToken]/page.tsx` | `handleDownloadPdf` | Stream `/api/public/invoices/[token]/pdf` | 🛠️ (Creating Endpoint) |

---

## Module 4: Payments & Receipts

| Route | Page | Allowed Roles | Button / Action | Component File | Handler Function | Backend / DB Mutation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/billing/invoices/[id]` | Invoice View | Super Admin, Finance Admin | Record Payment | `src/app/billing/invoices/[id]/page.tsx` | `handleRecordPaymentSubmit` | `db.recordPayment` -> `invoice_payments` | ✅ |
| `/billing/payments` | Payments List | Super Admin, Finance Admin | Download Receipt | `src/app/billing/payments/page.tsx` | Link to `/billing/receipts/[id]` | Browser Print API | ✅ |

---

## Module 5: Expenses

| Route | Page | Allowed Roles | Button / Action | Component File | Handler Function | Backend / DB Mutation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/billing/expenses` | Expenses | Super Admin, Finance Admin | Add Expense | `src/app/billing/expenses/page.tsx` | `handleAddExpense` | `db.addExpense` -> `expenses` | ✅ |
| `/billing/expenses` | Expenses | Super Admin, Finance Admin | Delete Expense | `src/app/billing/expenses/page.tsx` | `handleDeleteExpense` | `db.deleteExpense` -> `expenses` | ✅ |

---

## Module 6: Bank Accounts & Settings

| Route | Page | Allowed Roles | Button / Action | Component File | Handler Function | Backend / DB Mutation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/billing/settings/entities` | Entities | Super Admin, Finance Admin | Save Bank Details | `src/app/billing/settings/entities/page.tsx` | `handleSaveBank` | `db.saveBankAccount` -> `entity_bank_accounts` | ✅ |
| `/billing/settings/gateway-rates` | Rates | Super Admin, Finance Admin | Save Gateway Rates | `src/app/billing/settings/gateway-rates/page.tsx` | `handleSave` | `db.setGatewayRates` -> `gateway_rates` | ✅ |

---

## Module 7: Reserve, FDR & DPS

| Route | Page | Allowed Roles | Button / Action | Component File | Handler Function | Backend / DB Mutation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/billing/reserve` | Reserve | Super Admin, Finance Admin | Create FDR | `src/app/billing/reserve/page.tsx` | `handleCreateFdr` | `db.createFdrAccount` -> `fdr_records` | ✅ |
| `/billing/reserve` | Reserve | Super Admin, Finance Admin | Create DPS | `src/app/billing/reserve/page.tsx` | `handleCreateDps` | `db.createDpsAccount` -> `dps_records` | ✅ |
