-- Complete System-Wide Cloud Persistence & Security Repair Migration
-- Migration Timestamp: 20260730000000

-- 1. Profiles Table Username Unique Index (Case-Insensitive)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
ON public.profiles (lower(username))
WHERE username IS NOT NULL;

-- 2. Enable Row Level Security (RLS) across all business tables
ALTER TABLE public.business_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fdr_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dps_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Authenticated users can read business tables
DROP POLICY IF EXISTS "Authenticated users can read business entities" ON public.business_entities;
CREATE POLICY "Authenticated users can read business entities" ON public.business_entities
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read bank accounts" ON public.entity_bank_accounts;
CREATE POLICY "Authenticated users can read bank accounts" ON public.entity_bank_accounts
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.billing_clients;
CREATE POLICY "Authenticated users can read clients" ON public.billing_clients
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read invoices" ON public.invoices;
CREATE POLICY "Authenticated users can read invoices" ON public.invoices
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can read invoice items" ON public.invoice_items
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.payments;
CREATE POLICY "Authenticated users can read payments" ON public.payments
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read expenses" ON public.expenses;
CREATE POLICY "Authenticated users can read expenses" ON public.expenses
FOR SELECT USING (auth.role() = 'authenticated');

-- Restricted Reserve, FDR and DPS Policies (Only Super Admin, Admin, and Finance Admin roles)
DROP POLICY IF EXISTS "Financial roles can read reserve ledger" ON public.reserve_ledger;
CREATE POLICY "Financial roles can read reserve ledger" ON public.reserve_ledger
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role_name IN ('Super Admin', 'Admin', 'Finance Admin')
        )
    )
);

DROP POLICY IF EXISTS "Financial roles can read FDR records" ON public.fdr_records;
CREATE POLICY "Financial roles can read FDR records" ON public.fdr_records
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role_name IN ('Super Admin', 'Admin', 'Finance Admin')
        )
    )
);

DROP POLICY IF EXISTS "Financial roles can read DPS records" ON public.dps_records;
CREATE POLICY "Financial roles can read DPS records" ON public.dps_records
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role_name IN ('Super Admin', 'Admin', 'Finance Admin')
        )
    )
);

-- 4. Atomic Invoice Creation RPC Function
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
    p_invoice jsonb,
    p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_id uuid;
    v_entity_id uuid;
    v_client_id uuid;
    v_created_by uuid;
    v_item jsonb;
BEGIN
    v_invoice_id := (p_invoice->>'id')::uuid;
    v_entity_id := (p_invoice->>'entity_id')::uuid;
    v_client_id := (p_invoice->>'client_id')::uuid;
    v_created_by := NULLIF(p_invoice->>'created_by', '')::uuid;

    -- Validate Foreign Keys
    IF NOT EXISTS (SELECT 1 FROM public.business_entities WHERE id = v_entity_id) THEN
        RAISE EXCEPTION 'Foreign Key Failure: Entity ID % does not exist in business_entities', v_entity_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.billing_clients WHERE id = v_client_id) THEN
        RAISE EXCEPTION 'Foreign Key Failure: Client ID % does not exist in billing_clients', v_client_id;
    END IF;

    IF v_created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_created_by) THEN
        v_created_by := NULL;
    END IF;

    IF NULLIF(p_invoice->>'account_manager_id', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = (p_invoice->>'account_manager_id')::uuid) THEN
        p_invoice := jsonb_set(p_invoice, '{account_manager_id}', 'null');
    END IF;

    -- Insert Invoice
    INSERT INTO public.invoices (
        id, secure_token, invoice_number, status, entity_id, client_id, currency,
        issue_date, payment_terms, due_date, project_name, service_period, po_number,
        reference_number, account_manager_id, discount_type, discount_value, vat_rate,
        vat_inclusive, client_note, payment_instructions, terms_conditions, internal_note,
        created_by, created_at, updated_at
    ) VALUES (
        v_invoice_id,
        (p_invoice->>'secure_token')::uuid,
        p_invoice->>'invoice_number',
        p_invoice->>'status',
        v_entity_id,
        v_client_id,
        p_invoice->>'currency',
        (p_invoice->>'issue_date')::date,
        p_invoice->>'payment_terms',
        (p_invoice->>'due_date')::date,
        p_invoice->>'project_name',
        p_invoice->>'service_period',
        p_invoice->>'po_number',
        p_invoice->>'reference_number',
        NULLIF(p_invoice->>'account_manager_id', '')::uuid,
        p_invoice->>'discount_type',
        (p_invoice->>'discount_value')::numeric,
        (p_invoice->>'vat_rate')::numeric,
        COALESCE((p_invoice->>'vat_inclusive')::boolean, true),
        p_invoice->>'client_note',
        p_invoice->>'payment_instructions',
        p_invoice->>'terms_conditions',
        p_invoice->>'internal_note',
        v_created_by,
        COALESCE((p_invoice->>'created_at')::timestamptz, now()),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        currency = EXCLUDED.currency,
        issue_date = EXCLUDED.issue_date,
        due_date = EXCLUDED.due_date,
        project_name = EXCLUDED.project_name,
        discount_type = EXCLUDED.discount_type,
        discount_value = EXCLUDED.discount_value,
        vat_rate = EXCLUDED.vat_rate,
        updated_at = now();

    -- Insert Invoice Items
    DELETE FROM public.invoice_items WHERE invoice_id = v_invoice_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.invoice_items (
            id, invoice_id, service_name, description, quantity, unit, rate, amount, sort_order
        ) VALUES (
            (v_item->>'id')::uuid,
            v_invoice_id,
            COALESCE(v_item->>'service_name', v_item->>'description', 'Service Item'),
            v_item->>'description',
            (v_item->>'quantity')::numeric,
            COALESCE(v_item->>'unit', 'job'),
            COALESCE((v_item->>'rate')::numeric, (v_item->>'unit_price')::numeric, 0),
            (v_item->>'amount')::numeric,
            COALESCE((v_item->>'sort_order')::integer, (v_item->>'item_order')::integer, 0)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id
    );
END;
$$;
