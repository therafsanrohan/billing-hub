-- Migration: 20260731000001_ensure_tax_payments_and_settings.sql
-- Description: Ensure tax_payments and billing_settings exist with proper structure and RLS policies

-- 1. TAX PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.tax_payments (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL DEFAULT 'ent-1',
    tax_type TEXT NOT NULL CHECK (tax_type IN ('VAT', 'Corporate Tax')),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL,
    challan_number TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    recorded_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. BILLING SETTINGS TABLE (KEY-VALUE JSONB STORE)
CREATE TABLE IF NOT EXISTS public.billing_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ENABLE RLS
ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR AUTHENTICATED USERS
DROP POLICY IF EXISTS "Authenticated users can select tax_payments" ON public.tax_payments;
CREATE POLICY "Authenticated users can select tax_payments" ON public.tax_payments
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert tax_payments" ON public.tax_payments;
CREATE POLICY "Authenticated users can insert tax_payments" ON public.tax_payments
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can select billing_settings" ON public.billing_settings;
CREATE POLICY "Authenticated users can select billing_settings" ON public.billing_settings
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can all billing_settings" ON public.billing_settings;
CREATE POLICY "Authenticated users can all billing_settings" ON public.billing_settings
FOR ALL USING (auth.role() = 'authenticated');
