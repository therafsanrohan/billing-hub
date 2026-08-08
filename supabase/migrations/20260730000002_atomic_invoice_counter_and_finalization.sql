-- Migration: 20260730000002_atomic_invoice_counter_and_finalization.sql
-- Atomic PostgreSQL Counter, Idempotent Invoice Finalization, and Immutable Snapshot System

-- 1. Create document_number_counters Table
CREATE TABLE IF NOT EXISTS public.document_number_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    entity_id UUID NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'INVOICE',
    period_key TEXT NOT NULL,
    prefix TEXT NOT NULL,
    last_number BIGINT NOT NULL DEFAULT 0,
    padding INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES public.profiles(id),
    CONSTRAINT document_number_counters_unique_key UNIQUE (organization_id, entity_id, document_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_doc_counters_lookup ON public.document_number_counters(entity_id, document_type, period_key);

-- 2. Add Unique Constraint on invoices.invoice_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number_unique 
ON public.invoices(invoice_number) 
WHERE invoice_number IS NOT NULL AND invoice_number <> '';

-- 3. Enable RLS on document_number_counters
ALTER TABLE public.document_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read counters" ON public.document_number_counters;
CREATE POLICY "Authenticated users can read counters" ON public.document_number_counters
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage counters" ON public.document_number_counters;
CREATE POLICY "Authenticated users can manage counters" ON public.document_number_counters
FOR ALL USING (auth.role() = 'authenticated');

-- 4. Seed Initial Counters for Existing Entities
DO $$
DECLARE
    r RECORD;
    v_year TEXT := TO_CHAR(now(), 'YYYY');
    v_prefix TEXT;
    v_max_existing INT;
BEGIN
    FOR r IN SELECT id, entity_code, invoice_prefix FROM public.business_entities LOOP
        v_prefix := COALESCE(r.invoice_prefix, r.entity_code, 'INV');
        
        -- Determine highest existing serial if any
        SELECT COALESCE(MAX(
            CASE 
                WHEN invoice_number ~ ('^' || v_prefix || '-INV-' || v_year || '-\d+$')
                THEN (regexp_match(invoice_number, '\d+$'))[1]::INT
                ELSE 0
            END
        ), 0) INTO v_max_existing
        FROM public.invoices
        WHERE entity_id = r.id;

        INSERT INTO public.document_number_counters (
            entity_id,
            document_type,
            period_key,
            prefix,
            last_number,
            padding
        ) VALUES (
            r.id,
            'INVOICE',
            v_year,
            v_prefix,
            v_max_existing,
            4
        )
        ON CONFLICT (organization_id, entity_id, document_type, period_key) DO UPDATE SET
            last_number = GREATEST(public.document_number_counters.last_number, EXCLUDED.last_number),
            updated_at = now();
    END LOOP;
END;
$$;

-- 5. Atomic & Idempotent Invoice Finalization RPC Function
CREATE OR REPLACE FUNCTION public.finalize_invoice_and_assign_number(
    p_invoice_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_invoice RECORD;
    v_client RECORD;
    v_entity RECORD;
    v_bank RECORD;
    v_items JSONB;
    v_payments JSONB;
    v_year TEXT;
    v_prefix TEXT;
    v_counter RECORD;
    v_next_num BIGINT;
    v_final_number TEXT;
    v_subtotal NUMERIC := 0;
    v_discount_amt NUMERIC := 0;
    v_vat_amt NUMERIC := 0;
    v_total_payable NUMERIC := 0;
    v_amount_paid NUMERIC := 0;
    v_amount_due NUMERIC := 0;
    v_snapshot_id UUID;
    v_public_token TEXT;
    v_public_link_id UUID;
BEGIN
    -- 1. Lock invoice row FOR UPDATE
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice with ID % does not exist.', p_invoice_id;
    END IF;

    -- 2. Idempotent check: If already approved with an invoice_number, return cleanly
    IF v_invoice.status = 'approved' AND v_invoice.invoice_number IS NOT NULL AND v_invoice.invoice_number <> '' THEN
        RETURN jsonb_build_object(
            'success', true,
            'id', v_invoice.id,
            'invoice_number', v_invoice.invoice_number,
            'status', v_invoice.status,
            'message', 'Invoice is already approved and finalized.'
        );
    END IF;

    -- 3. Validate Entity & Currency Alignment
    SELECT * INTO v_entity
    FROM public.business_entities
    WHERE id = v_invoice.entity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Business entity ID % not found.', v_invoice.entity_id;
    END IF;

    IF v_invoice.currency = 'BDT' AND v_entity.entity_code <> 'CLTD' THEN
        -- Auto-correct entity to CLTD if needed
        SELECT * INTO v_entity FROM public.business_entities WHERE entity_code = 'CLTD' LIMIT 1;
        UPDATE public.invoices SET entity_id = v_entity.id WHERE id = p_invoice_id;
    ELSIF v_invoice.currency = 'USD' AND v_entity.entity_code <> 'CLLC' THEN
        -- Auto-correct entity to CLLC if needed
        SELECT * INTO v_entity FROM public.business_entities WHERE entity_code = 'CLLC' LIMIT 1;
        UPDATE public.invoices SET entity_id = v_entity.id WHERE id = p_invoice_id;
    END IF;

    -- 4. Validate Client
    SELECT * INTO v_client
    FROM public.billing_clients
    WHERE id = v_invoice.client_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Billing client ID % not found.', v_invoice.client_id;
    END IF;

    -- 5. Lock Document Number Counter FOR UPDATE
    v_year := TO_CHAR(COALESCE(v_invoice.issue_date, CURRENT_DATE), 'YYYY');
    v_prefix := COALESCE(v_entity.invoice_prefix, v_entity.entity_code, 'INV');

    INSERT INTO public.document_number_counters (
        entity_id,
        document_type,
        period_key,
        prefix,
        last_number,
        padding
    ) VALUES (
        v_entity.id,
        'INVOICE',
        v_year,
        v_prefix,
        0,
        4
    )
    ON CONFLICT (organization_id, entity_id, document_type, period_key) DO NOTHING;

    SELECT * INTO v_counter
    FROM public.document_number_counters
    WHERE entity_id = v_entity.id
      AND document_type = 'INVOICE'
      AND period_key = v_year
    FOR UPDATE;

    LOOP
        v_next_num := v_counter.last_number + 1;
        v_final_number := v_prefix || '-INV-' || v_year || '-' || LPAD(v_next_num::text, v_counter.padding, '0');
        
        v_counter.last_number := v_next_num;

        -- Check if v_final_number already exists in active invoices OR deleted_invoice_register
        IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE invoice_number = v_final_number)
           AND (
               NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deleted_invoice_register')
               OR NOT EXISTS (SELECT 1 FROM public.deleted_invoice_register WHERE invoice_number = v_final_number)
           ) THEN
            EXIT;
        END IF;
    END LOOP;

    -- Increment counter
    UPDATE public.document_number_counters
    SET last_number = v_next_num,
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = v_counter.id;

    -- 6. Update Invoice Record
    UPDATE public.invoices
    SET invoice_number = v_final_number,
        status = 'approved',
        approved_by = COALESCE(p_user_id, approved_by),
        approved_at = now(),
        updated_at = now()
    WHERE id = p_invoice_id;

    -- 7. Gather Line Items & Totals for Immutable Snapshot
    SELECT jsonb_agg(to_jsonb(i)) INTO v_items
    FROM public.invoice_items i
    WHERE i.invoice_id = p_invoice_id;

    SELECT * INTO v_bank
    FROM public.entity_bank_accounts
    WHERE entity_id = v_entity.id AND is_active = true
    LIMIT 1;

    -- Calculate Totals
    SELECT COALESCE(SUM(amount), 0) INTO v_subtotal
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id;

    IF v_invoice.discount_type = 'percentage' THEN
        v_discount_amt := (v_subtotal * COALESCE(v_invoice.discount_value, 0)) / 100.0;
    ELSIF v_invoice.discount_type = 'fixed' THEN
        v_discount_amt := COALESCE(v_invoice.discount_value, 0);
    END IF;

    IF v_invoice.currency = 'BDT' AND COALESCE(v_invoice.vat_rate, 0) > 0 THEN
        IF v_invoice.vat_inclusive THEN
            v_vat_amt := (v_subtotal - v_discount_amt) - ((v_subtotal - v_discount_amt) / (1.0 + (v_invoice.vat_rate / 100.0)));
            v_total_payable := v_subtotal - v_discount_amt;
        ELSE
            v_vat_amt := ((v_subtotal - v_discount_amt) * v_invoice.vat_rate) / 100.0;
            v_total_payable := (v_subtotal - v_discount_amt) + v_vat_amt;
        END IF;
    ELSE
        v_total_payable := v_subtotal - v_discount_amt;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_amount_paid
    FROM public.invoice_payments
    WHERE invoice_id = p_invoice_id;

    v_amount_due := GREATEST(0, v_total_payable - v_amount_paid);

    -- 8. Write Immutable Snapshot
    INSERT INTO public.invoice_snapshots (
        invoice_id,
        entity_snapshot,
        client_snapshot,
        bank_snapshot,
        items_snapshot,
        totals_snapshot,
        snapshot_hash
    ) VALUES (
        p_invoice_id,
        to_jsonb(v_entity),
        to_jsonb(v_client),
        CASE WHEN v_bank.id IS NOT NULL THEN to_jsonb(v_bank) ELSE NULL END,
        COALESCE(v_items, '[]'::jsonb),
        jsonb_build_object(
            'subtotal', v_subtotal,
            'discount_amount', v_discount_amt,
            'vat_amount', v_vat_amt,
            'total_payable', v_total_payable,
            'amount_paid', v_amount_paid,
            'amount_due', v_amount_due
        ),
        encode(digest(v_final_number || p_invoice_id::text, 'sha256'), 'hex')
    )
    ON CONFLICT (invoice_id) DO UPDATE SET
        entity_snapshot = EXCLUDED.entity_snapshot,
        client_snapshot = EXCLUDED.client_snapshot,
        bank_snapshot = EXCLUDED.bank_snapshot,
        items_snapshot = EXCLUDED.items_snapshot,
        totals_snapshot = EXCLUDED.totals_snapshot,
        snapshot_hash = EXCLUDED.snapshot_hash,
        created_at = now();

    -- 9. Ensure Public Capability Link Exists
    INSERT INTO public.invoice_public_links (
        invoice_id,
        organization_id,
        version,
        is_active,
        access_mode,
        created_by,
        key_version
    ) VALUES (
        p_invoice_id,
        v_entity.id,
        1,
        true,
        'LINK_ONLY',
        p_user_id,
        1
    )
    ON CONFLICT (invoice_id) DO UPDATE SET
        is_active = true,
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'id', p_invoice_id,
        'invoice_number', v_final_number,
        'status', 'approved',
        'subtotal', v_subtotal,
        'total_payable', v_total_payable
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_invoice_and_assign_number(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_invoice_and_assign_number(UUID, UUID) TO service_role;
