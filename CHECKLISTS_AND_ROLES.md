# Checklists, Roles, and Known Limitations

This document contains team role specifications, configuration guides, limitations, and checksheets for launch.

---

## 1. User Roles & Access Rights

The application enforces role permissions at the database level using Row Level Security (RLS) policies:

| Action / Capability | Super Admin | Finance Admin | Client Service | Project Manager | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Manage Company Settings & Bank Info** | Yes | No | No | No | No |
| **Manage Team & Roles** | Yes | No | No | No | No |
| **Approve & Void Invoices** | Yes | Yes | No | No | No |
| **Record Manual Payments & Receipts** | Yes | Yes | No | No | No |
| **Create & Update Clients** | Yes | Yes | Yes | No | No |
| **Create & Update Invoice Drafts** | Yes | Yes | Yes | Yes | No |
| **View Audit Logs** | Yes | No | No | No | No |
| **View General Reports & Dashboards** | Yes | Yes | Yes | Yes (Read Only) | Read Only |

---

## 2. Admin Settings Configuration Checklist

Before sending the first live invoice, the **Super Admin** must complete this checklist:

* [ ] Log in as a **Super Admin** account.
* [ ] Navigate to **Settings > Business Entities**.
* [ ] Pre-populate **Corevow Limited (BDT)** with the Bangladesh bank accounts, BIN, registration number, and address.
* [ ] Pre-populate **Corevow LLC (USD)** with the SWIFT, international routing details, EIN, and address.
* [ ] Enter the default payment instructions footer (this saves automatically to new drafts).
* [ ] Go to the **Team** screen and assign roles to your team members' emails as they sign up.

---

## 3. Production Launch Checklist

* [ ] Connect the GitHub repository to the production project in Vercel.
* [ ] Verify all environment variables match your live Supabase credentials.
* [ ] In your Supabase project, enable **Row Level Security (RLS)** on all tables.
* [ ] Confirm that your domain CNAME record points to `cname.vercel-dns.com` and that SSL is active at `https://billing.app.com`.
* [ ] Run calculation test checks.
* [ ] Test the full user flow in Sandbox Mode, then log in to the Live DB mode.
* [ ] Create the first sample invoice, approve it, print to A4, and inspect alignment.

---

## 4. Known Limitations (V1)

* **Manual Payments Only**: V1 does not process credit card online checkout directly. Payments are logged manually by the Finance Admin or Super Admin upon verifying bank deposits.
* **No Automated Currency Conversion**: Exchange rate calculations between BDT and USD are not automatically computed. Reports display BDT and USD figures separately to prevent mixing rates.
* **Email dispatch via SMTP/Resend API**: Emails are sent using the Resend platform API. Custom sender domains require adding DKIM/SPF DNS records inside Resend settings.
