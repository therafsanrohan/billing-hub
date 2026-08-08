-- ==============================================================================
-- Migration: 20260728000000_fix_saas_cloud_persistence.sql
-- Description: Complete SaaS Multi-Tenancy, Canonical RBAC, RLS Hardening,
--              Confidential Financial Access, Atomic 20% Reserve RPC, and Audit Logging.
-- ==============================================================================

-- 1. Ensure Extension for UUID Generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations & Core Access Schema
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default Organization if not present
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-4000-8000-000000000001', 'app Global', 'app-global')
ON CONFLICT (id) DO NOTHING;

-- Canonical Roles Enum / Table Definition
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key TEXT UNIQUE NOT NULL, -- e.g. super_admin, admin, finance, client_service, project_manager, viewer
    display_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Canonical Roles
INSERT INTO public.roles (role_key, display_name, description)
VALUES 
    ('super_admin', 'Super Admin', 'Full system access across all modules and settings'),
    ('admin', 'Admin', 'Administrative access to organization resources'),
    ('finance', 'Finance Department', 'Full access to financial, billing, reserve, FDR and DPS modules'),
    ('client_service', 'Client Service', 'Access to clients, projects, quotations and invoices'),
    ('project_manager', 'Project Manager', 'Access to projects, tasks and project invoices'),
    ('viewer', 'Viewer', 'Read-only access to basic non-confidential modules')
ON CONFLICT (role_key) DO UPDATE SET display_name = EXCLUDED.display_name;

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Ensure profiles has organization_id, canonical role_name, active status
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-4000-8000-000000000001',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Update existing profiles to default org if NULL
UPDATE public.profiles SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;

-- Normalize role names in profiles
UPDATE public.profiles SET role_name = 'super_admin' WHERE LOWER(role_name) IN ('super admin', 'super-admin', 'superadmin');
UPDATE public.profiles SET role_name = 'admin' WHERE LOWER(role_name) IN ('administrator', 'admin');
UPDATE public.profiles SET role_name = 'finance' WHERE LOWER(role_name) IN ('finance admin', 'finance department', 'finance_admin');
UPDATE public.profiles SET role_name = 'client_service' WHERE LOWER(role_name) IN ('client service', 'client-service');
UPDATE public.profiles SET role_name = 'project_manager' WHERE LOWER(role_name) IN ('project manager', 'project-manager');
UPDATE public.profiles SET role_name = 'viewer' WHERE LOWER(role_name) IN ('read only', 'viewer');

-- 3. Multitenancy Migration: Add organization_id to all business tables
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'clients', 'client_contacts', 'projects', 'services', 
        'quotations', 'quotation_items', 'invoices', 'invoice_items', 
        'payments', 'payment_allocations', 'refunds', 'credit_notes', 
        'expenses', 'expense_categories', 'vendors', 'bank_accounts', 
        'cash_accounts', 'cash_transactions', 'tax_records', 'vat_records', 
        'reserve_settings', 'reserve_transactions', 'reserve_withdrawal_requests', 
        'reserve_approvals', 'investment_accounts', 'investment_transactions', 
        'fdr_records', 'dps_records', 'dps_installments', 'attachments', 
        'notifications', 'activity_logs', 'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT ''00000000-0000-4000-8000-000000000001''', tbl);
            EXECUTE format('UPDATE public.%I SET organization_id = ''00000000-0000-4000-8000-000000000001'' WHERE organization_id IS NULL', tbl);
        END IF;
    END LOOP;
END $$;

-- 4. Audit Log System Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) DEFAULT '00000000-0000-4000-8000-000000000001',
    actor_id UUID REFERENCES public.profiles(id),
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    previous_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Helper Functions for Security & RLS (with Search Path Control)
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT role_name FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND is_active = TRUE 
          AND role_name = ANY(allowed_roles)
    );
$$;

-- 6. Atomic 20% Reserve & Payment Allocation RPC
CREATE OR REPLACE FUNCTION public.record_payment_and_allocate_reserve(
    p_invoice_id UUID,
    p_amount NUMERIC(18,2),
    p_payment_method TEXT,
    p_reference_number TEXT,
    p_bank_account_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_role TEXT;
    v_invoice RECORD;
    v_payment_id UUID;
    v_reserve_pct NUMERIC(5,2) := 20.00;
    v_reserve_amount NUMERIC(18,2);
    v_operating_cash NUMERIC(18,2);
    v_new_paid NUMERIC(18,2);
    v_new_due NUMERIC(18,2);
    v_new_status TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to process payments';
    END IF;

    -- Fetch user profile & org
    SELECT organization_id, role_name INTO v_org_id, v_role 
    FROM public.profiles WHERE id = v_user_id;

    IF v_org_id IS NULL THEN
        v_org_id := '00000000-0000-4000-8000-000000000001';
    END IF;

    -- Fetch & lock invoice for update
    SELECT * INTO v_invoice FROM public.invoices 
    WHERE id = p_invoice_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- Fetch active reserve percentage from DB settings if exists
    SELECT COALESCE(reserve_percentage, 20.00) INTO v_reserve_pct
    FROM public.reserve_settings 
    WHERE organization_id = v_org_id AND status = 'ACTIVE' 
    ORDER BY created_at DESC LIMIT 1;

    IF v_reserve_pct IS NULL THEN
        v_reserve_pct := 20.00;
    END IF;

    -- Calculate reserve and operating cash (NUMERIC exact)
    v_reserve_amount := ROUND((p_amount * (v_reserve_pct / 100.00)), 2);
    v_operating_cash := p_amount - v_reserve_amount;

    -- Create Payment Record
    v_payment_id := gen_random_uuid();
    INSERT INTO public.payments (
        id, organization_id, invoice_id, amount, payment_method, 
        reference_number, bank_account_id, payment_date, notes, created_by
    ) VALUES (
        v_payment_id, v_org_id, p_invoice_id, p_amount, p_payment_method, 
        p_reference_number, p_bank_account_id, NOW(), p_notes, v_user_id
    );

    -- Calculate Invoice New Totals
    v_new_paid := COALESCE(v_invoice.paid_amount, 0) + p_amount;
    v_new_due := GREATEST(0.00, COALESCE(v_invoice.total_amount, 0) - v_new_paid);

    IF v_new_due = 0 THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'partially_paid';
    END IF;

    -- Update Invoice Status
    UPDATE public.invoices 
    SET paid_amount = v_new_paid, 
        due_amount = v_new_due, 
        status = v_new_status, 
        updated_at = NOW() 
    WHERE id = p_invoice_id;

    -- Record Reserve Contribution (Asset Allocation)
    INSERT INTO public.reserve_transactions (
        id, organization_id, source_payment_id, invoice_id, amount, 
        percentage_applied, transaction_type, notes, created_by
    ) VALUES (
        gen_random_uuid(), v_org_id, v_payment_id, p_invoice_id, v_reserve_amount, 
        v_reserve_pct, 'AUTO_ALLOCATION', '20% Auto-Reserve from Payment', v_user_id
    );

    -- Record Operating Cash Flow
    INSERT INTO public.cash_transactions (
        id, organization_id, source_payment_id, amount, transaction_type, notes, created_by
    ) VALUES (
        gen_random_uuid(), v_org_id, v_payment_id, v_operating_cash, 'INFLOW', 'Operating Cash (Net of Reserve)', v_user_id
    );

    -- Audit Log
    INSERT INTO public.audit_logs (
        organization_id, actor_id, actor_role, action, entity_type, entity_id, new_values
    ) VALUES (
        v_org_id, v_user_id, v_role, 'RECORD_PAYMENT', 'payments', v_payment_id,
        jsonb_build_object(
            'payment_id', v_payment_id,
            'invoice_id', p_invoice_id,
            'total_payment', p_amount,
            'reserve_allocated', v_reserve_amount,
            'operating_cash', v_operating_cash
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'reserve_allocated', v_reserve_amount,
        'operating_cash', v_operating_cash,
        'new_status', v_new_status,
        'due_amount', v_new_due
    );
END;
$$;

-- 7. RLS Policy Enforcement & Confidential Access Rules
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'organizations', 'profiles', 'clients', 'client_contacts', 'projects', 
        'services', 'quotations', 'quotation_items', 'invoices', 'invoice_items', 
        'payments', 'payment_allocations', 'refunds', 'credit_notes', 
        'expenses', 'expense_categories', 'vendors', 'bank_accounts', 
        'cash_accounts', 'cash_transactions', 'tax_records', 'vat_records', 
        'reserve_settings', 'reserve_transactions', 'reserve_withdrawal_requests', 
        'reserve_approvals', 'investment_accounts', 'investment_transactions', 
        'fdr_records', 'dps_records', 'dps_installments', 'attachments', 
        'notifications', 'activity_logs', 'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_select_policy_' || tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_insert_policy_' || tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_update_policy_' || tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_delete_policy_' || tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- Public/General Business Policies (All authenticated active users in same organization)
CREATE POLICY tenant_select_general ON public.invoices FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY tenant_insert_general ON public.invoices FOR INSERT TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY tenant_update_general ON public.invoices FOR UPDATE TO authenticated
    USING (organization_id = public.current_user_organization_id());

-- CONFIDENTIAL FINANCIAL ACCESS POLICIES: Restricted to super_admin, admin, finance ONLY
CREATE POLICY confidential_reserve_select ON public.reserve_transactions FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id() AND public.has_role(ARRAY['super_admin', 'admin', 'finance']));

CREATE POLICY confidential_fdr_select ON public.fdr_records FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id() AND public.has_role(ARRAY['super_admin', 'admin', 'finance']));

CREATE POLICY confidential_dps_select ON public.dps_records FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id() AND public.has_role(ARRAY['super_admin', 'admin', 'finance']));

CREATE POLICY confidential_investment_select ON public.investment_accounts FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id() AND public.has_role(ARRAY['super_admin', 'admin', 'finance']));

-- 8. Indexes for High Performance Multitenant Queries
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_org_date ON public.payments(organization_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_reserve_tx_org ON public.reserve_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_actor ON public.audit_logs(organization_id, actor_id);
