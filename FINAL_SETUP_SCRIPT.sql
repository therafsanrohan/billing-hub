-- ==========================================
-- Source: 20260721000000_initial_schema.sql
-- ==========================================
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


-- ==========================================
-- Source: 20260721000001_functions_and_policies.sql
-- ==========================================
-- Stored Procedures, Triggers, and RLS Policies for Corevow Billing Hub V1

-- 1. ATOMIC SEQUENCE & INVOICE NUMBER GENERATION FUNCTION
CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_invoice_id UUID,
  p_approved_by_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_currency TEXT;
  v_entity_code TEXT;
  v_year INT;
  v_seq INT;
  v_invoice_number TEXT;
  v_entity_id UUID;
  v_client_id UUID;
  v_issue_date DATE;
  v_discount_type TEXT;
  v_discount_value NUMERIC(12, 2);
  v_vat_rate NUMERIC(5, 2);
  v_vat_inclusive BOOLEAN;
  v_subtotal NUMERIC(12, 2);
  v_discount_amount NUMERIC(12, 2);
  v_total_payable NUMERIC(12, 2);
  
  v_entity_row RECORD;
  v_bank_row RECORD;
  v_client_row RECORD;
BEGIN
  -- Fetch invoice, lock row for update to prevent concurrent race conditions
  SELECT client_id, currency, entity_id, issue_date, discount_type, discount_value, vat_rate, vat_inclusive
  INTO v_client_id, v_currency, v_entity_id, v_issue_date, v_discount_type, v_discount_value, v_vat_rate, v_vat_inclusive
  FROM invoices
  WHERE id = p_invoice_id AND (status = 'pending_approval' OR status = 'draft')
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice is not in pending_approval/draft status or does not exist';
  END IF;
  
  -- Determine entity code
  SELECT entity_code INTO v_entity_code
  FROM business_entities
  WHERE id = v_entity_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business entity not found';
  END IF;
  
  -- Extract year from issue date
  v_year := EXTRACT(YEAR FROM v_issue_date);
  
  -- Increment sequence atomically, using row lock for sequence matching entity and year
  INSERT INTO invoice_sequences (entity_code, year, last_sequence)
  VALUES (v_entity_code, v_year, 1)
  ON CONFLICT (entity_code, year)
  DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1, updated_at = now()
  RETURNING last_sequence INTO v_seq;
  
  -- Format invoice number
  v_invoice_number := v_entity_code || '-' || v_currency || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  
  -- Perform decimal-safe calculations of totals
  SELECT COALESCE(SUM(amount), 0.00) INTO v_subtotal
  FROM invoice_items
  WHERE invoice_id = p_invoice_id;
  
  IF v_discount_type = 'fixed' THEN
    v_discount_amount := v_discount_value;
  ELSIF v_discount_type = 'percentage' THEN
    v_discount_amount := ROUND(v_subtotal * (v_discount_value / 100.0), 2);
  ELSE
    v_discount_amount := 0.00;
  END IF;
  
  IF v_discount_amount > v_subtotal THEN
    v_discount_amount := v_subtotal;
  END IF;
  
  v_total_payable := v_subtotal - v_discount_amount;
  
  -- Fetch snapshots
  SELECT legal_name, registered_address, registration_number, tax_id, email, phone, website
  INTO v_entity_row
  FROM business_entities
  WHERE id = v_entity_id;
  
  SELECT bank_name, account_holder, account_number, branch, routing_number, swift_bic, bank_address
  INTO v_bank_row
  FROM entity_bank_accounts
  WHERE entity_id = v_entity_id AND is_active = true
  LIMIT 1;
  
  SELECT company_name, contact_person, billing_email, billing_address, phone, tax_number
  INTO v_client_row
  FROM billing_clients
  WHERE id = v_client_id;
  
  -- Create historical static snapshots
  INSERT INTO invoice_snapshots (
    invoice_id,
    entity_snapshot,
    bank_snapshot,
    client_snapshot,
    totals_snapshot
  ) VALUES (
    p_invoice_id,
    row_to_json(v_entity_row)::JSONB,
    row_to_json(v_bank_row)::JSONB,
    row_to_json(v_client_row)::JSONB,
    json_build_object(
      'subtotal', v_subtotal,
      'discount_amount', v_discount_amount,
      'total_payable', v_total_payable,
      'amount_paid', 0.00,
      'amount_due', v_total_payable
    )::JSONB
  );
  
  -- Finalize invoice details
  UPDATE invoices
  SET 
    invoice_number = v_invoice_number,
    status = 'approved',
    approved_by = p_approved_by_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_invoice_id;
  
  -- Write system audit log
  INSERT INTO billing_audit_logs (user_id, action, module, record_id, previous_value, new_value)
  VALUES (
    p_approved_by_id,
    'approve_invoice',
    'invoices',
    p_invoice_id::TEXT,
    json_build_object('status', 'draft')::JSONB,
    json_build_object('status', 'approved', 'invoice_number', v_invoice_number)::JSONB
  );
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;


-- 2. ROW LEVEL SECURITY (RLS) STATE
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;

-- 3. PROFILE POLICIES
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
CREATE POLICY "Users can read all profiles" ON profiles
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON profiles;
CREATE POLICY "Super Admins can manage all profiles" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );

-- 4. BUSINESS ENTITY POLICIES
DROP POLICY IF EXISTS "Authenticated users can read business entities" ON business_entities;
CREATE POLICY "Authenticated users can read business entities" ON business_entities
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super Admins can manage business entities" ON business_entities;
CREATE POLICY "Super Admins can manage business entities" ON business_entities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );

-- 5. BANK ACCOUNT POLICIES
DROP POLICY IF EXISTS "Authenticated users can read bank accounts" ON entity_bank_accounts;
CREATE POLICY "Authenticated users can read bank accounts" ON entity_bank_accounts
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super Admins can manage bank accounts" ON entity_bank_accounts;
CREATE POLICY "Super Admins can manage bank accounts" ON entity_bank_accounts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );

-- 6. CLIENT POLICIES
DROP POLICY IF EXISTS "Authenticated users can read clients" ON billing_clients;
CREATE POLICY "Authenticated users can read clients" ON billing_clients
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authorized team members can insert/update clients" ON billing_clients;
CREATE POLICY "Authorized team members can insert/update clients" ON billing_clients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_name IN ('Super Admin', 'Finance Admin', 'Client Service')
        )
    );

-- 7. INVOICE POLICIES
DROP POLICY IF EXISTS "Authenticated users can read invoices" ON invoices;
CREATE POLICY "Authenticated users can read invoices" ON invoices
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authorized team members can manage invoice drafts" ON invoices;
CREATE POLICY "Authorized team members can manage invoice drafts" ON invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_name IN ('Super Admin', 'Finance Admin', 'Client Service', 'Project Manager')
        )
    );

-- 8. INVOICE ITEMS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read invoice items" ON invoice_items;
CREATE POLICY "Authenticated users can read invoice items" ON invoice_items
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authorized team members can manage invoice items" ON invoice_items;
CREATE POLICY "Authorized team members can manage invoice items" ON invoice_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_name IN ('Super Admin', 'Finance Admin', 'Client Service', 'Project Manager')
        )
    );

-- 9. INVOICE SNAPSHOT POLICIES
DROP POLICY IF EXISTS "Authenticated users can read snapshots" ON invoice_snapshots;
CREATE POLICY "Authenticated users can read snapshots" ON invoice_snapshots
    FOR SELECT USING (auth.role() = 'authenticated');

-- 10. PAYMENTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read payments" ON invoice_payments;
CREATE POLICY "Authenticated users can read payments" ON invoice_payments
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Finance Admins and Super Admins can manage payments" ON invoice_payments;
CREATE POLICY "Finance Admins and Super Admins can manage payments" ON invoice_payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_name IN ('Super Admin', 'Finance Admin')
        )
    );

-- 11. MONEY RECEIPTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read receipts" ON money_receipts;
CREATE POLICY "Authenticated users can read receipts" ON money_receipts
    FOR SELECT USING (auth.role() = 'authenticated');

-- 12. EMAIL LOGS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read email logs" ON invoice_email_logs;
CREATE POLICY "Authenticated users can read email logs" ON invoice_email_logs
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authorized team members can create email logs" ON invoice_email_logs;
CREATE POLICY "Authorized team members can create email logs" ON invoice_email_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 13. AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Super Admins can read audit logs" ON billing_audit_logs;
CREATE POLICY "Super Admins can read audit logs" ON billing_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );

-- 14. SETTINGS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read settings" ON billing_settings;
CREATE POLICY "Authenticated users can read settings" ON billing_settings
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super Admins can update settings" ON billing_settings;
CREATE POLICY "Super Admins can update settings" ON billing_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );


-- ==========================================
-- Source: 20260722000000_vat_and_tax_tables.sql
-- ==========================================
-- Migration for VAT Management, Corporate Tax, System Notifications, and Expense/Invoice Enhancements

-- 1. VAT REGISTRATION PROFILE
CREATE TABLE IF NOT EXISTS vat_registration_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL DEFAULT 'ent-1',
    business_name TEXT NOT NULL DEFAULT 'Corevow Limited',
    bin_number TEXT NOT NULL DEFAULT '001234567-0101',
    bin_status TEXT NOT NULL DEFAULT 'VAT_REGISTERED',
    registration_effective_date DATE DEFAULT '2021-07-01',
    vat_circle TEXT DEFAULT 'Banani Circle',
    vat_division TEXT DEFAULT 'Dhaka North Division',
    registered_address TEXT DEFAULT 'House 12, Road 4, Banani, Dhaka 1213, Bangladesh',
    default_return_frequency TEXT DEFAULT 'MONTHLY',
    default_currency TEXT DEFAULT 'BDT',
    status TEXT DEFAULT 'ACTIVE',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. VAT CONFIGURATIONS (Financial-Year Based)
CREATE TABLE IF NOT EXISTS vat_configurations (
    id TEXT PRIMARY KEY,
    country_code TEXT NOT NULL DEFAULT 'BD',
    financial_year TEXT NOT NULL,
    configuration_name TEXT NOT NULL,
    registration_type TEXT NOT NULL DEFAULT 'VAT_REGISTERED',
    return_frequency TEXT NOT NULL DEFAULT 'MONTHLY',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    version_number INT DEFAULT 1,
    change_summary TEXT,
    source_reference TEXT DEFAULT 'NBR Value Added Tax and Supplementary Duty Act 2012',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE
);

-- 3. VAT SERVICE CATEGORIES
CREATE TABLE IF NOT EXISTS vat_service_categories (
    id TEXT PRIMARY KEY,
    vat_configuration_id TEXT REFERENCES vat_configurations(id) ON DELETE CASCADE,
    category_code TEXT NOT NULL,
    category_name TEXT NOT NULL,
    official_service_code TEXT NOT NULL,
    description TEXT,
    vat_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.1500,
    vds_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.1500,
    is_vds_applicable BOOLEAN DEFAULT true,
    is_input_credit_allowed BOOLEAN DEFAULT true,
    is_zero_rated BOOLEAN DEFAULT false,
    is_exempt BOOLEAN DEFAULT false,
    is_custom_rate_allowed BOOLEAN DEFAULT true,
    effective_from DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'ACTIVE'
);

-- 4. VAT DOCUMENTS (Mushak 6.3, Mushak 6.6 VDS, Zero-Rate Evidence)
CREATE TABLE IF NOT EXISTS vat_documents (
    id TEXT PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (document_type IN ('MUSHAK_6_3', 'MUSHAK_6_6', 'PURCHASE_VAT_INVOICE', 'ZERO_RATE_EVIDENCE')),
    document_number TEXT NOT NULL,
    document_date DATE NOT NULL,
    tax_period TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    invoice_id TEXT,
    client_id TEXT,
    vendor_name TEXT,
    vendor_bin TEXT,
    verification_status TEXT DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'ISSUED', 'RECEIVED')),
    verified_by TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. INPUT VAT PURCHASE REGISTER
CREATE TABLE IF NOT EXISTS input_vat_entries (
    id TEXT PRIMARY KEY,
    expense_id TEXT,
    vendor_name TEXT NOT NULL,
    vendor_bin TEXT NOT NULL,
    purchase_invoice_number TEXT,
    mushak_6_3_number TEXT,
    purchase_date DATE NOT NULL,
    taxable_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    input_vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    approved_input_vat NUMERIC(12, 2) DEFAULT 0.00,
    eligibility_status TEXT DEFAULT 'ELIGIBLE_INPUT_CREDIT' CHECK (eligibility_status IN ('ELIGIBLE_INPUT_CREDIT', 'INELIGIBLE', 'PARTIALLY_ELIGIBLE', 'PENDING_AUDIT')),
    verification_status TEXT DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    tax_period TEXT NOT NULL,
    approved_by TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. VAT RETURNS
CREATE TABLE IF NOT EXISTS vat_returns (
    id TEXT PRIMARY KEY,
    financial_year TEXT NOT NULL,
    tax_period TEXT NOT NULL,
    gross_output_vat NUMERIC(12, 2) DEFAULT 0.00,
    eligible_input_vat NUMERIC(12, 2) DEFAULT 0.00,
    increasing_adjustments NUMERIC(12, 2) DEFAULT 0.00,
    decreasing_adjustments NUMERIC(12, 2) DEFAULT 0.00,
    vds_decreasing_adjustments NUMERIC(12, 2) DEFAULT 0.00,
    treasury_deposit_amount NUMERIC(12, 2) DEFAULT 0.00,
    net_vat_payable NUMERIC(12, 2) DEFAULT 0.00,
    return_status TEXT DEFAULT 'DRAFT' CHECK (return_status IN ('DRAFT', 'AUDITED', 'SUBMITTED', 'CHALLAN_PAID')),
    submission_date DATE,
    challan_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. VAT AUDIT LOGS
CREATE TABLE IF NOT EXISTS vat_audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SYSTEM NOTIFICATIONS (Notice Board Broadcast)
CREATE TABLE IF NOT EXISTS system_notifications (
    id TEXT PRIMARY KEY,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'broadcast',
    target_roles TEXT[] NOT NULL DEFAULT '{"all"}'::TEXT[],
    link_url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_by TEXT[] DEFAULT '{}'::TEXT[]
);

-- RLS Enablement
ALTER TABLE vat_registration_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE input_vat_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for authenticated/anon application usage
DROP POLICY IF EXISTS "Allow public select on vat_registration_profiles" ON vat_registration_profiles;
CREATE POLICY "Allow public select on vat_registration_profiles" ON vat_registration_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public all on vat_registration_profiles" ON vat_registration_profiles;
CREATE POLICY "Allow public all on vat_registration_profiles" ON vat_registration_profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public select on vat_configurations" ON vat_configurations;
CREATE POLICY "Allow public select on vat_configurations" ON vat_configurations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public all on vat_configurations" ON vat_configurations;
CREATE POLICY "Allow public all on vat_configurations" ON vat_configurations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public select on vat_service_categories" ON vat_service_categories;
CREATE POLICY "Allow public select on vat_service_categories" ON vat_service_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public all on vat_service_categories" ON vat_service_categories;
CREATE POLICY "Allow public all on vat_service_categories" ON vat_service_categories FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public select on vat_documents" ON vat_documents;
CREATE POLICY "Allow public select on vat_documents" ON vat_documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public all on vat_documents" ON vat_documents;
CREATE POLICY "Allow public all on vat_documents" ON vat_documents FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public select on input_vat_entries" ON input_vat_entries;
CREATE POLICY "Allow public select on input_vat_entries" ON input_vat_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public all on input_vat_entries" ON input_vat_entries;
CREATE POLICY "Allow public all on input_vat_entries" ON input_vat_entries FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public select on vat_returns" ON vat_returns;
CREATE POLICY "Allow public select on vat_returns" ON vat_returns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public all on vat_returns" ON vat_returns;
CREATE POLICY "Allow public all on vat_returns" ON vat_returns FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public select on vat_audit_logs" ON vat_audit_logs;
CREATE POLICY "Allow public select on vat_audit_logs" ON vat_audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public all on vat_audit_logs" ON vat_audit_logs;
CREATE POLICY "Allow public all on vat_audit_logs" ON vat_audit_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public select on system_notifications" ON system_notifications;
CREATE POLICY "Allow public select on system_notifications" ON system_notifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public all on system_notifications" ON system_notifications;
CREATE POLICY "Allow public all on system_notifications" ON system_notifications FOR ALL USING (true);


-- ==========================================
-- Source: 20260724000000_cloud_migration_functions_and_rls.sql
-- ==========================================
-- Migration for Atomic Payment & Reserve Allocation Stored Procedure, Reversals, and Confidential RLS Policies

-- 1. ATOMIC PAYMENT RECORDING AND 20% EMERGENCY RESERVE ALLOCATION FUNCTION
CREATE OR REPLACE FUNCTION record_payment_and_allocate_reserve(
  p_invoice_id UUID,
  p_payment_date DATE,
  p_amount NUMERIC(15, 2),
  p_currency TEXT,
  p_payment_method TEXT,
  p_transaction_reference TEXT,
  p_bank_gateway TEXT,
  p_recorded_by UUID,
  p_internal_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_invoice RECORD;
  v_entity RECORD;
  v_year INT;
  v_seq INT;
  v_receipt_number TEXT;
  v_sequence_key TEXT;
  v_payment_id UUID;
  v_reserve_percentage NUMERIC(5, 2);
  v_reserve_amount NUMERIC(15, 2);
  v_total_paid NUMERIC(15, 2);
  v_subtotal NUMERIC(15, 2);
  v_discount_amount NUMERIC(15, 2);
  v_total_payable NUMERIC(15, 2);
  v_new_status TEXT;
  v_result JSONB;
BEGIN
  -- 1. Fetch & lock invoice for update
  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice with ID % not found', p_invoice_id;
  END IF;

  -- Fetch entity
  SELECT * INTO v_entity
  FROM business_entities
  WHERE id = v_invoice.entity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity with ID % not found', v_invoice.entity_id;
  END IF;

  -- 2. Generate Receipt Number atomically e.g. CLTD-REC-2026-0001
  v_year := EXTRACT(YEAR FROM p_payment_date);
  v_sequence_key := 'rec_' || v_entity.receipt_prefix || '_' || v_year::TEXT;

  INSERT INTO invoice_sequences (entity_code, year, last_sequence)
  VALUES (v_entity.receipt_prefix, v_year, 1)
  ON CONFLICT (entity_code, year)
  DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1, updated_at = now()
  RETURNING last_sequence INTO v_seq;

  v_receipt_number := v_entity.receipt_prefix || '-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');
  v_payment_id := gen_random_uuid();

  -- 3. Create invoice payment record
  INSERT INTO invoice_payments (
    id,
    invoice_id,
    payment_date,
    amount,
    currency,
    payment_method,
    transaction_reference,
    bank_gateway,
    internal_note,
    recorded_by,
    receipt_number,
    created_at,
    updated_at
  ) VALUES (
    v_payment_id,
    p_invoice_id,
    p_payment_date,
    p_amount,
    p_currency,
    p_payment_method,
    p_transaction_reference,
    p_bank_gateway,
    p_internal_note,
    p_recorded_by,
    v_receipt_number,
    now(),
    now()
  );

  -- 4. Calculate invoice totals and update invoice status
  SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
  FROM invoice_payments
  WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0.00) INTO v_subtotal
  FROM invoice_items
  WHERE invoice_id = p_invoice_id;

  IF v_invoice.discount_type = 'fixed' THEN
    v_discount_amount := v_invoice.discount_value;
  ELSIF v_invoice.discount_type = 'percentage' THEN
    v_discount_amount := ROUND(v_subtotal * (v_invoice.discount_value / 100.0), 2);
  ELSE
    v_discount_amount := 0.00;
  END IF;

  v_total_payable := v_subtotal - v_discount_amount;

  IF v_total_paid >= v_total_payable THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE invoices
  SET status = v_new_status, updated_at = now()
  WHERE id = p_invoice_id;

  -- 5. Read active reserve percentage (default 20%)
  SELECT reserve_percentage INTO v_reserve_percentage
  FROM reserve_settings
  WHERE id = 'default-setting';

  IF NOT FOUND OR v_reserve_percentage IS NULL THEN
    v_reserve_percentage := 20.00;
  END IF;

  v_reserve_amount := ROUND(p_amount * (v_reserve_percentage / 100.00), 2);

  -- 6. Atomically insert 20% Reserve Allocation into reserve_ledger
  IF v_reserve_amount > 0 THEN
    INSERT INTO reserve_ledger (
      id,
      entity_id,
      currency,
      transaction_type,
      amount,
      source,
      payment_id,
      invoice_id,
      client_id,
      deposit_date,
      reason,
      status,
      created_by,
      created_at
    ) VALUES (
      'res-tx-' || extract(epoch from now())::bigint || '-' || trunc(random()*1000)::text,
      v_invoice.entity_id::TEXT,
      p_currency,
      'AUTOMATIC_RESERVE_ALLOCATION',
      v_reserve_amount,
      'CLIENT_PAYMENT',
      v_payment_id::TEXT,
      p_invoice_id::TEXT,
      v_invoice.client_id::TEXT,
      p_payment_date,
      v_reserve_percentage::TEXT || '% Automatic emergency reserve allocation from payment (Receipt #' || v_receipt_number || ')',
      'COMPLETED',
      'SYSTEM',
      now()
    );
  END IF;

  -- 7. Log immutable financial audit
  INSERT INTO financial_audit_logs (
    id,
    user_id,
    user_role,
    action,
    module,
    record_id,
    new_value,
    timestamp
  ) VALUES (
    'fin-audit-' || extract(epoch from now())::bigint || '-' || trunc(random()*1000)::text,
    p_recorded_by::TEXT,
    'AUTHENTICATED_USER',
    'RECORD_PAYMENT_AND_ALLOCATE_RESERVE',
    'PAYMENTS_AND_RESERVE',
    v_payment_id::TEXT,
    json_build_object(
      'payment_id', v_payment_id,
      'receipt_number', v_receipt_number,
      'amount', p_amount,
      'reserve_allocated', v_reserve_amount,
      'reserve_percentage', v_reserve_percentage
    )::JSONB,
    now()
  );

  v_result := json_build_object(
    'payment_id', v_payment_id,
    'receipt_number', v_receipt_number,
    'amount', p_amount,
    'currency', p_currency,
    'reserve_allocated', v_reserve_amount,
    'invoice_status', v_new_status
  )::JSONB;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. REVERSE PAYMENT AND ADJUST RESERVE FUNCTION
CREATE OR REPLACE FUNCTION reverse_payment_and_adjust_reserve(
  p_payment_id UUID,
  p_reason TEXT,
  p_reversed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_payment RECORD;
  v_reserve_tx RECORD;
BEGIN
  SELECT * INTO v_payment
  FROM invoice_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment ID % not found', p_payment_id;
  END IF;

  -- Find corresponding reserve allocation transaction
  SELECT * INTO v_reserve_tx
  FROM reserve_ledger
  WHERE payment_id = p_payment_id::TEXT AND status = 'COMPLETED'
  LIMIT 1;

  -- Insert reversing entry in reserve_ledger if found
  IF FOUND THEN
    INSERT INTO reserve_ledger (
      id,
      entity_id,
      currency,
      transaction_type,
      amount,
      source,
      payment_id,
      invoice_id,
      client_id,
      deposit_date,
      reason,
      status,
      created_by,
      created_at
    ) VALUES (
      'res-tx-rev-' || extract(epoch from now())::bigint,
      v_reserve_tx.entity_id,
      v_reserve_tx.currency,
      'REFUND_ADJUSTMENT',
      v_reserve_tx.amount,
      'PAYMENT_REVERSAL',
      p_payment_id::TEXT,
      v_payment.invoice_id::TEXT,
      v_reserve_tx.client_id,
      CURRENT_DATE,
      'Reversal of payment #' || v_payment.receipt_number || ' - Reason: ' || p_reason,
      'COMPLETED',
      'SYSTEM',
      now()
    );

    UPDATE reserve_ledger
    SET status = 'REVERSED'
    WHERE id = v_reserve_tx.id;
  END IF;

  -- Delete payment record
  DELETE FROM invoice_payments WHERE id = p_payment_id;

  -- Recalculate invoice status
  DECLARE
    v_total_paid NUMERIC(15, 2);
    v_subtotal NUMERIC(15, 2);
    v_discount_amount NUMERIC(15, 2);
    v_total_payable NUMERIC(15, 2);
    v_invoice RECORD;
  BEGIN
    SELECT * INTO v_invoice FROM invoices WHERE id = v_payment.invoice_id;
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid FROM invoice_payments WHERE invoice_id = v_payment.invoice_id;
    SELECT COALESCE(SUM(amount), 0.00) INTO v_subtotal FROM invoice_items WHERE invoice_id = v_payment.invoice_id;

    IF v_invoice.discount_type = 'fixed' THEN
      v_discount_amount := v_invoice.discount_value;
    ELSIF v_invoice.discount_type = 'percentage' THEN
      v_discount_amount := ROUND(v_subtotal * (v_invoice.discount_value / 100.0), 2);
    ELSE
      v_discount_amount := 0.00;
    END IF;

    v_total_payable := v_subtotal - v_discount_amount;

    IF v_total_paid = 0 THEN
      UPDATE invoices SET status = 'approved', updated_at = now() WHERE id = v_payment.invoice_id;
    ELSIF v_total_paid < v_total_payable THEN
      UPDATE invoices SET status = 'partially_paid', updated_at = now() WHERE id = v_payment.invoice_id;
    END IF;
  END;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. CONFIDENTIAL RLS POLICIES FOR RESERVE, SAVINGS, FDR AND DPS TABLES
ALTER TABLE reserve_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE fdr_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dps_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dps_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user has confidential finance access
CREATE OR REPLACE FUNCTION is_finance_authorized()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_name IN ('Super Admin', 'Admin', 'Finance Admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confidential Reserve Policies
DROP POLICY IF EXISTS "Confidential read on reserve_settings" ON reserve_settings;
CREATE POLICY "Confidential read on reserve_settings" ON reserve_settings
    FOR SELECT USING (is_finance_authorized() OR true);

DROP POLICY IF EXISTS "Authorized edit on reserve_settings" ON reserve_settings;
CREATE POLICY "Authorized edit on reserve_settings" ON reserve_settings
    FOR ALL USING (is_finance_authorized());

DROP POLICY IF EXISTS "Confidential read on reserve_ledger" ON reserve_ledger;
CREATE POLICY "Confidential read on reserve_ledger" ON reserve_ledger
    FOR SELECT USING (is_finance_authorized() OR true);

DROP POLICY IF EXISTS "Authorized write on reserve_ledger" ON reserve_ledger;
CREATE POLICY "Authorized write on reserve_ledger" ON reserve_ledger
    FOR ALL USING (is_finance_authorized());

DROP POLICY IF EXISTS "Confidential read on fdr_accounts" ON fdr_accounts;
CREATE POLICY "Confidential read on fdr_accounts" ON fdr_accounts
    FOR SELECT USING (is_finance_authorized() OR true);

DROP POLICY IF EXISTS "Authorized write on fdr_accounts" ON fdr_accounts;
CREATE POLICY "Authorized write on fdr_accounts" ON fdr_accounts
    FOR ALL USING (is_finance_authorized());

DROP POLICY IF EXISTS "Confidential read on dps_accounts" ON dps_accounts;
CREATE POLICY "Confidential read on dps_accounts" ON dps_accounts
    FOR SELECT USING (is_finance_authorized() OR true);

DROP POLICY IF EXISTS "Authorized write on dps_accounts" ON dps_accounts;
CREATE POLICY "Authorized write on dps_accounts" ON dps_accounts
    FOR ALL USING (is_finance_authorized());

DROP POLICY IF EXISTS "Confidential read on dps_installments" ON dps_installments;
CREATE POLICY "Confidential read on dps_installments" ON dps_installments
    FOR SELECT USING (is_finance_authorized() OR true);

DROP POLICY IF EXISTS "Authorized write on dps_installments" ON dps_installments;
CREATE POLICY "Authorized write on dps_installments" ON dps_installments
    FOR ALL USING (is_finance_authorized());

DROP POLICY IF EXISTS "Confidential read on withdrawal_requests" ON reserve_withdrawal_requests;
CREATE POLICY "Confidential read on withdrawal_requests" ON reserve_withdrawal_requests
    FOR SELECT USING (is_finance_authorized() OR true);

DROP POLICY IF EXISTS "Authorized write on withdrawal_requests" ON reserve_withdrawal_requests;
CREATE POLICY "Authorized write on withdrawal_requests" ON reserve_withdrawal_requests
    FOR ALL USING (is_finance_authorized());


-- ==========================================
-- Source: 20260725000000_fix_cloud_persistence_and_auth.sql
-- ==========================================
-- Corrective Migration: Fix Cloud Database Persistence, Canonical Roles, and Idempotent Policies

-- 1. UPDATE ROLE CHECK CONSTRAINT ON PROFILES
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_name_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_name_check CHECK (
    role_name IN (
        'Super Admin', 'super_admin',
        'Admin', 'admin',
        'Finance Admin', 'finance', 'finance_admin',
        'Client Service', 'client_service',
        'Project Manager', 'project_manager',
        'Viewer', 'viewer'
    )
);

-- 2. AUTOMATIC PROFILE CREATION TRIGGER ON SUPABASE AUTH SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role_name, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role_name', 'Super Admin'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger on auth.users if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 3. ENSURE RLS HELPER FUNCTION & IDEMPOTENT PROFILES POLICIES
CREATE OR REPLACE FUNCTION is_finance_authorized()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_name IN ('Super Admin', 'super_admin', 'Admin', 'admin', 'Finance Admin', 'finance', 'finance_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotent RLS Policies for Profiles
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON profiles;
CREATE POLICY "Super Admins can manage all profiles" ON profiles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role_name IN ('Super Admin', 'super_admin', 'Admin', 'admin')
  )
);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 4. GRANT TABLE PERMISSIONS TO AUTHENTICATED USERS
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- Master Migration: Fix All RLS Policy Recursion across All Tables

-- 1. SECURITY DEFINER HELPER FUNCTIONS (Bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role_name IN ('Super Admin', 'super_admin', 'Admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_finance_authorized()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role_name IN ('Super Admin', 'super_admin', 'Admin', 'admin', 'Finance Admin', 'finance', 'finance_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role_name IN (
      'Super Admin', 'super_admin',
      'Admin', 'admin',
      'Finance Admin', 'finance', 'finance_admin',
      'Client Service', 'client_service',
      'Project Manager', 'project_manager'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. PROFILES POLICIES
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert profiles" ON profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users or admins can update profiles" ON profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin_user());
CREATE POLICY "Admins can delete profiles" ON profiles FOR DELETE USING (public.is_admin_user());

-- 3. BUSINESS ENTITIES POLICIES
DROP POLICY IF EXISTS "Authenticated users can read business entities" ON business_entities;
DROP POLICY IF EXISTS "Super Admins can manage business entities" ON business_entities;
DROP POLICY IF EXISTS "Admins can manage business entities" ON business_entities;

CREATE POLICY "Authenticated users can read business entities" ON business_entities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage business entities" ON business_entities FOR ALL USING (public.is_admin_user());

-- 4. BANK ACCOUNTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read bank accounts" ON entity_bank_accounts;
DROP POLICY IF EXISTS "Super Admins can manage bank accounts" ON entity_bank_accounts;
DROP POLICY IF EXISTS "Admins can manage bank accounts" ON entity_bank_accounts;

CREATE POLICY "Authenticated users can read bank accounts" ON entity_bank_accounts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage bank accounts" ON entity_bank_accounts FOR ALL USING (public.is_admin_user());

-- 5. CLIENTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read clients" ON billing_clients;
DROP POLICY IF EXISTS "Authorized team members can insert/update clients" ON billing_clients;
DROP POLICY IF EXISTS "Team members can manage clients" ON billing_clients;

CREATE POLICY "Authenticated users can read clients" ON billing_clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Team members can manage clients" ON billing_clients FOR ALL USING (public.is_team_member());

-- 6. INVOICES POLICIES
DROP POLICY IF EXISTS "Authenticated users can read invoices" ON invoices;
DROP POLICY IF EXISTS "Authorized team members can manage invoice drafts" ON invoices;
DROP POLICY IF EXISTS "Team members can manage invoices" ON invoices;

CREATE POLICY "Authenticated users can read invoices" ON invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Team members can manage invoices" ON invoices FOR ALL USING (public.is_team_member());

-- 7. INVOICE ITEMS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Authorized team members can manage invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Team members can manage invoice items" ON invoice_items;

CREATE POLICY "Authenticated users can read invoice items" ON invoice_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Team members can manage invoice items" ON invoice_items FOR ALL USING (public.is_team_member());

-- 8. INVOICE SNAPSHOTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read snapshots" ON invoice_snapshots;
DROP POLICY IF EXISTS "Team members can manage snapshots" ON invoice_snapshots;

CREATE POLICY "Authenticated users can read snapshots" ON invoice_snapshots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Team members can manage snapshots" ON invoice_snapshots FOR ALL USING (public.is_team_member());

-- 9. PAYMENTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read payments" ON invoice_payments;
DROP POLICY IF EXISTS "Finance Admins and Super Admins can manage payments" ON invoice_payments;
DROP POLICY IF EXISTS "Finance authorized can manage payments" ON invoice_payments;

CREATE POLICY "Authenticated users can read payments" ON invoice_payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Finance authorized can manage payments" ON invoice_payments FOR ALL USING (public.is_finance_authorized());

-- 10. MONEY RECEIPTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read receipts" ON money_receipts;
DROP POLICY IF EXISTS "Finance authorized can manage receipts" ON money_receipts;

CREATE POLICY "Authenticated users can read receipts" ON money_receipts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Finance authorized can manage receipts" ON money_receipts FOR ALL USING (public.is_finance_authorized());

-- 11. EMAIL LOGS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read email logs" ON invoice_email_logs;
DROP POLICY IF EXISTS "Authorized team members can create email logs" ON invoice_email_logs;

CREATE POLICY "Authenticated users can read email logs" ON invoice_email_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can create email logs" ON invoice_email_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 12. AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Super Admins can read audit logs" ON billing_audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs" ON billing_audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON billing_audit_logs;

CREATE POLICY "Admins can read audit logs" ON billing_audit_logs FOR SELECT USING (public.is_admin_user());
CREATE POLICY "Authenticated users can insert audit logs" ON billing_audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 13. SETTINGS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read settings" ON billing_settings;
DROP POLICY IF EXISTS "Super Admins can update settings" ON billing_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON billing_settings;

CREATE POLICY "Authenticated users can read settings" ON billing_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can update settings" ON billing_settings FOR ALL USING (public.is_admin_user());

-- 14. EXPENSES POLICIES
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read expenses" ON expenses;
DROP POLICY IF EXISTS "Team members can manage expenses" ON expenses;

CREATE POLICY "Authenticated users can read expenses" ON expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Team members can manage expenses" ON expenses FOR ALL USING (public.is_team_member());

-- 15. RESERVE & SAVINGS POLICIES
DROP POLICY IF EXISTS "Confidential read on reserve_settings" ON reserve_settings;
DROP POLICY IF EXISTS "Authorized edit on reserve_settings" ON reserve_settings;
DROP POLICY IF EXISTS "Confidential read on reserve_ledger" ON reserve_ledger;
DROP POLICY IF EXISTS "Authorized write on reserve_ledger" ON reserve_ledger;
DROP POLICY IF EXISTS "Confidential read on fdr_accounts" ON fdr_accounts;
DROP POLICY IF EXISTS "Authorized write on fdr_accounts" ON fdr_accounts;
DROP POLICY IF EXISTS "Confidential read on dps_accounts" ON dps_accounts;
DROP POLICY IF EXISTS "Authorized write on dps_accounts" ON dps_accounts;
DROP POLICY IF EXISTS "Confidential read on dps_installments" ON dps_installments;
DROP POLICY IF EXISTS "Authorized write on dps_installments" ON dps_installments;
DROP POLICY IF EXISTS "Confidential read on withdrawal_requests" ON reserve_withdrawal_requests;
DROP POLICY IF EXISTS "Authorized write on withdrawal_requests" ON reserve_withdrawal_requests;
DROP POLICY IF EXISTS "Finance read on reserve_settings" ON reserve_settings;
DROP POLICY IF EXISTS "Finance write on reserve_settings" ON reserve_settings;
DROP POLICY IF EXISTS "Finance read on reserve_ledger" ON reserve_ledger;
DROP POLICY IF EXISTS "Finance write on reserve_ledger" ON reserve_ledger;
DROP POLICY IF EXISTS "Finance read on fdr_accounts" ON fdr_accounts;
DROP POLICY IF EXISTS "Finance write on fdr_accounts" ON fdr_accounts;
DROP POLICY IF EXISTS "Finance read on dps_accounts" ON dps_accounts;
DROP POLICY IF EXISTS "Finance write on dps_accounts" ON dps_accounts;
DROP POLICY IF EXISTS "Finance read on dps_installments" ON dps_installments;
DROP POLICY IF EXISTS "Finance write on dps_installments" ON dps_installments;
DROP POLICY IF EXISTS "Finance read on withdrawal_requests" ON reserve_withdrawal_requests;
DROP POLICY IF EXISTS "Finance write on withdrawal_requests" ON reserve_withdrawal_requests;

CREATE POLICY "Finance read on reserve_settings" ON reserve_settings FOR SELECT USING (public.is_finance_authorized());
CREATE POLICY "Finance write on reserve_settings" ON reserve_settings FOR ALL USING (public.is_finance_authorized());

CREATE POLICY "Finance read on reserve_ledger" ON reserve_ledger FOR SELECT USING (public.is_finance_authorized());
CREATE POLICY "Finance write on reserve_ledger" ON reserve_ledger FOR ALL USING (public.is_finance_authorized());

CREATE POLICY "Finance read on fdr_accounts" ON fdr_accounts FOR SELECT USING (public.is_finance_authorized());
CREATE POLICY "Finance write on fdr_accounts" ON fdr_accounts FOR ALL USING (public.is_finance_authorized());

CREATE POLICY "Finance read on dps_accounts" ON dps_accounts FOR SELECT USING (public.is_finance_authorized());
CREATE POLICY "Finance write on dps_accounts" ON dps_accounts FOR ALL USING (public.is_finance_authorized());

CREATE POLICY "Finance read on dps_installments" ON dps_installments FOR SELECT USING (public.is_finance_authorized());
CREATE POLICY "Finance write on dps_installments" ON dps_installments FOR ALL USING (public.is_finance_authorized());

CREATE POLICY "Finance read on withdrawal_requests" ON reserve_withdrawal_requests FOR SELECT USING (public.is_finance_authorized());
CREATE POLICY "Finance write on withdrawal_requests" ON reserve_withdrawal_requests FOR ALL USING (public.is_finance_authorized());
