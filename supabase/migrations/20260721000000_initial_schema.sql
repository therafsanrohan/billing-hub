-- Initial Schema Setup for Corevow Billing Hub V1

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & ROLES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role_name TEXT NOT NULL CHECK (role_name IN ('Super Admin', 'Finance Admin', 'Client Service', 'Project Manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. BUSINESS ENTITIES (CLTD, CLLC)
CREATE TABLE IF NOT EXISTS business_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name TEXT NOT NULL,
    entity_code TEXT UNIQUE NOT NULL CHECK (entity_code IN ('CLTD', 'CLLC')),
    logo_url TEXT,
    registered_address TEXT NOT NULL,
    registration_number TEXT NOT NULL,
    tax_id TEXT NOT NULL, -- TIN/BIN for CLTD, EIN for CLLC
    email TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    payment_instructions TEXT,
    invoice_prefix TEXT NOT NULL,
    receipt_prefix TEXT NOT NULL,
    vat_footer TEXT,
    bkash_merchant TEXT,
    nagad_merchant TEXT,
    signature_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS entity_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES business_entities(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    account_number TEXT NOT NULL,
    branch TEXT,
    routing_number TEXT,
    swift_bic TEXT,
    bank_address TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CLIENTS
CREATE TABLE IF NOT EXISTS billing_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_type TEXT NOT NULL CHECK (client_type IN ('company', 'individual')),
    company_name TEXT,
    contact_person TEXT NOT NULL,
    billing_email TEXT NOT NULL,
    additional_emails TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    phone TEXT,
    billing_address TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    tax_number TEXT,
    preferred_currency TEXT DEFAULT 'USD' NOT NULL CHECK (preferred_currency IN ('BDT', 'USD')),
    default_payment_terms TEXT DEFAULT '30 Days' NOT NULL CHECK (default_payment_terms IN ('Due on Receipt', '7 Days', '15 Days', '30 Days', 'Custom')),
    account_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    internal_note TEXT,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secure_token UUID UNIQUE DEFAULT gen_random_uuid() NOT NULL,
    client_id UUID NOT NULL REFERENCES billing_clients(id),
    currency TEXT NOT NULL CHECK (currency IN ('BDT', 'USD')),
    entity_id UUID NOT NULL REFERENCES business_entities(id),
    invoice_number TEXT UNIQUE, -- generated atomically upon approval
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void')),
    issue_date DATE NOT NULL,
    payment_terms TEXT NOT NULL,
    due_date DATE NOT NULL,
    project_name TEXT NOT NULL,
    service_period TEXT,
    po_number TEXT,
    reference_number TEXT,
    account_manager_id UUID REFERENCES profiles(id),
    discount_type TEXT DEFAULT 'none' NOT NULL CHECK (discount_type IN ('none', 'fixed', 'percentage')),
    discount_value NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (discount_value >= 0),
    vat_rate NUMERIC(5, 2) DEFAULT 0.00 NOT NULL CHECK (vat_rate >= 0),
    vat_inclusive BOOLEAN DEFAULT true NOT NULL,
    client_note TEXT,
    payment_instructions TEXT,
    terms_conditions TEXT,
    internal_note TEXT, -- MUST NEVER be displayed on client facing formats
    pdf_file_url TEXT,
    pdf_generated_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity >= 0),
    unit TEXT NOT NULL,
    rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. INVOICE SNAPSHOTS (Preserves historic data)
CREATE TABLE IF NOT EXISTS invoice_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID UNIQUE NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    entity_snapshot JSONB NOT NULL,
    bank_snapshot JSONB NOT NULL,
    client_snapshot JSONB NOT NULL,
    totals_snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SEQUENCES
CREATE TABLE IF NOT EXISTS invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_code TEXT NOT NULL CHECK (entity_code IN ('CLTD', 'CLLC')),
    year INT NOT NULL,
    last_sequence INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (entity_code, year)
);

-- 9. PAYMENTS
CREATE TABLE IF NOT EXISTS invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    payment_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL CHECK (currency IN ('BDT', 'USD')),
    payment_method TEXT NOT NULL,
    transaction_reference TEXT,
    bank_gateway TEXT,
    processing_fee NUMERIC(12, 2) DEFAULT 0.00 CHECK (processing_fee >= 0),
    internal_note TEXT,
    proof_url TEXT,
    recorded_by UUID REFERENCES profiles(id),
    receipt_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. RECEIPTS
CREATE TABLE IF NOT EXISTS money_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID UNIQUE NOT NULL REFERENCES invoice_payments(id) ON DELETE CASCADE,
    receipt_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. EMAIL LOGS
CREATE TABLE IF NOT EXISTS invoice_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    recipient TEXT NOT NULL,
    cc TEXT,
    email_type TEXT NOT NULL CHECK (email_type IN ('invoice', 'reminder', 'receipt')),
    subject TEXT NOT NULL,
    message_body TEXT NOT NULL,
    provider_message_id TEXT,
    delivery_status TEXT DEFAULT 'pending' NOT NULL,
    error_message TEXT,
    sent_by UUID REFERENCES profiles(id),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. AUDIT LOGS
CREATE TABLE IF NOT EXISTS billing_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    record_id TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. SETTINGS
CREATE TABLE IF NOT EXISTS billing_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
