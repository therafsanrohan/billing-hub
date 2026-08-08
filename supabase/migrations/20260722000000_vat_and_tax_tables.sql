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
CREATE POLICY "Allow public select on vat_registration_profiles" ON vat_registration_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public all on vat_registration_profiles" ON vat_registration_profiles FOR ALL USING (true);

CREATE POLICY "Allow public select on vat_configurations" ON vat_configurations FOR SELECT USING (true);
CREATE POLICY "Allow public all on vat_configurations" ON vat_configurations FOR ALL USING (true);

CREATE POLICY "Allow public select on vat_service_categories" ON vat_service_categories FOR SELECT USING (true);
CREATE POLICY "Allow public all on vat_service_categories" ON vat_service_categories FOR ALL USING (true);

CREATE POLICY "Allow public select on vat_documents" ON vat_documents FOR SELECT USING (true);
CREATE POLICY "Allow public all on vat_documents" ON vat_documents FOR ALL USING (true);

CREATE POLICY "Allow public select on input_vat_entries" ON input_vat_entries FOR SELECT USING (true);
CREATE POLICY "Allow public all on input_vat_entries" ON input_vat_entries FOR ALL USING (true);

CREATE POLICY "Allow public select on vat_returns" ON vat_returns FOR SELECT USING (true);
CREATE POLICY "Allow public all on vat_returns" ON vat_returns FOR ALL USING (true);

CREATE POLICY "Allow public select on vat_audit_logs" ON vat_audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public all on vat_audit_logs" ON vat_audit_logs FOR ALL USING (true);

CREATE POLICY "Allow public select on system_notifications" ON system_notifications FOR SELECT USING (true);
CREATE POLICY "Allow public all on system_notifications" ON system_notifications FOR ALL USING (true);
