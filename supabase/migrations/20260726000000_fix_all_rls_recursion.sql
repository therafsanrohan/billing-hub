-- Master Migration: Fix All RLS Policy Recursion & Ensure Expenses Table

-- 0. ENSURE EXPENSES TABLE EXISTS
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES business_entities(id),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL CHECK (currency IN ('BDT', 'USD')),
    expense_date DATE NOT NULL,
    vendor TEXT NOT NULL,
    invoice_ref TEXT,
    recorded_by UUID REFERENCES profiles(id),
    vendor_bin TEXT,
    mushak_6_3_number TEXT,
    input_vat_amount NUMERIC(12, 2) DEFAULT 0.00,
    input_credit_status TEXT DEFAULT 'ELIGIBLE_INPUT_CREDIT',
    verification_status TEXT DEFAULT 'PENDING',
    tax_period TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure username column exists on profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Ensure tax and vat columns exist on business_entities table
ALTER TABLE public.business_entities ADD COLUMN IF NOT EXISTS corporate_tax_rate NUMERIC(12,2) DEFAULT 30.00;
ALTER TABLE public.business_entities ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(12,2) DEFAULT 15.00;

-- Update handle_new_user trigger function to safely extract username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role_name, username, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role_name', 'Super Admin'),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    full_name = EXCLUDED.full_name,
    username = COALESCE(EXCLUDED.username, profiles.username),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- 11. AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Super Admins can read audit logs" ON billing_audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs" ON billing_audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON billing_audit_logs;

CREATE POLICY "Admins can read audit logs" ON billing_audit_logs FOR SELECT USING (public.is_admin_user());
CREATE POLICY "Authenticated users can insert audit logs" ON billing_audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 12. EXPENSES POLICIES
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read expenses" ON expenses;
DROP POLICY IF EXISTS "Team members can manage expenses" ON expenses;

CREATE POLICY "Authenticated users can read expenses" ON expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Team members can manage expenses" ON expenses FOR ALL USING (public.is_team_member());
