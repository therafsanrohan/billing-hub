-- Client Service Rates
CREATE TABLE IF NOT EXISTS client_service_rates (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    unit TEXT DEFAULT 'qty',
    is_paid_media BOOLEAN DEFAULT false,
    usd_budget NUMERIC(12, 2),
    usd_rate NUMERIC(12, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tax Configurations
CREATE TABLE IF NOT EXISTS tax_configurations (
    id TEXT PRIMARY KEY,
    country_code TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    assessment_year TEXT NOT NULL,
    configuration_name TEXT NOT NULL,
    bank_compliant_tax_rate NUMERIC(6, 4) NOT NULL,
    standard_tax_rate NUMERIC(6, 4) NOT NULL,
    turnover_threshold NUMERIC(15, 2) NOT NULL,
    turnover_minimum_rate NUMERIC(6, 4) NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE,
    status TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    change_summary TEXT NOT NULL,
    source_reference TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE
);

-- Tax Audit Logs
CREATE TABLE IF NOT EXISTS tax_audit_logs (
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

-- RLS Enablement
ALTER TABLE client_service_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (similar to other tables in this app)
CREATE POLICY "Enable all for authenticated users on client_service_rates" ON client_service_rates FOR ALL USING (public.is_team_member());
CREATE POLICY "Enable all for authenticated users on tax_configurations" ON tax_configurations FOR ALL USING (public.is_team_member());
CREATE POLICY "Enable all for authenticated users on tax_audit_logs" ON tax_audit_logs FOR ALL USING (public.is_team_member());
