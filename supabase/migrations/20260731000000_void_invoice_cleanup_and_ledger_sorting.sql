-- Migration: 20260731000000_void_invoice_cleanup_and_ledger_sorting.sql
-- Description: Void Invoice Archive & Deletion Workflow, Deleted Register, and Invoice Ledger Sorting Indexes

-- 1. Alter invoices table for Archiving
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archive_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_archived_at ON public.invoices(archived_at);
CREATE INDEX IF NOT EXISTS idx_invoices_status_archived ON public.invoices(status, archived_at);

-- 2. Create deleted_invoice_register Table to preserve issued finalized invoice numbers permanently
CREATE TABLE IF NOT EXISTS public.deleted_invoice_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_invoice_id UUID NOT NULL,
    organization_id UUID,
    entity_id UUID REFERENCES public.business_entities(id),
    invoice_number TEXT NOT NULL,
    invoice_status TEXT NOT NULL,
    client_reference TEXT,
    currency TEXT NOT NULL,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    deletion_reason TEXT NOT NULL,
    deleted_by UUID REFERENCES public.profiles(id),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    original_created_at TIMESTAMP WITH TIME ZONE,
    original_finalized_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT deleted_invoice_register_number_key UNIQUE (invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_deleted_inv_reg_number ON public.deleted_invoice_register(invoice_number);
CREATE INDEX IF NOT EXISTS idx_deleted_inv_reg_org ON public.deleted_invoice_register(organization_id, deleted_at DESC);

-- Enable RLS on deleted_invoice_register
ALTER TABLE public.deleted_invoice_register ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view deleted invoice register" ON public.deleted_invoice_register;
CREATE POLICY "Authenticated users can view deleted invoice register" ON public.deleted_invoice_register
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super Admins can insert into deleted invoice register" ON public.deleted_invoice_register;
CREATE POLICY "Super Admins can insert into deleted invoice register" ON public.deleted_invoice_register
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Check Void Invoice Permanent Delete Eligibility Function
CREATE OR REPLACE FUNCTION public.check_void_invoice_delete_eligibility(
    p_invoice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_client RECORD;
    v_reasons TEXT[] := ARRAY[]::TEXT[];
    v_payment_count INT := 0;
    v_tax_count INT := 0;
    v_vat_count INT := 0;
    v_reserve_count INT := 0;
    v_fdr_dps_count INT := 0;
    v_total NUMERIC := 0;
BEGIN
    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('eligible', false, 'reasons', ARRAY['Invoice not found']);
    END IF;

    SELECT * INTO v_client FROM public.billing_clients WHERE id = v_inv.client_id;

    -- Check 1: Must be void
    IF v_inv.status <> 'void' THEN
        v_reasons := array_append(v_reasons, 'Invoice status is not void (current: ' || v_inv.status || ')');
    END IF;

    -- Check 2: Payments / Partial / Refund
    SELECT COUNT(*) INTO v_payment_count FROM public.invoice_payments WHERE invoice_id = p_invoice_id;
    IF v_payment_count > 0 THEN
        v_reasons := array_append(v_reasons, 'Related payment records exist (' || v_payment_count || ' transactions)');
    END IF;

    -- Check 3: Tax payment dependency
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_payments') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.tax_payments WHERE invoice_id = $1' INTO v_tax_count USING p_invoice_id;
        IF v_tax_count > 0 THEN
            v_reasons := array_append(v_reasons, 'Related tax payment records exist');
        END IF;
    END IF;

    -- Check 4: VAT return dependency
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vat_documents') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.vat_documents WHERE invoice_id = $1' INTO v_vat_count USING p_invoice_id;
        IF v_vat_count > 0 THEN
            v_reasons := array_append(v_reasons, 'Related VAT document records exist');
        END IF;
    END IF;

    -- Check 5: Reserve transaction dependency
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_reserve_ledger') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.company_reserve_ledger WHERE invoice_id = $1' INTO v_reserve_count USING p_invoice_id;
        IF v_reserve_count > 0 THEN
            v_reasons := array_append(v_reasons, 'Related reserve transaction records exist');
        END IF;
    END IF;

    -- Get total from snapshot or fallback
    v_total := COALESCE((v_inv.total_payable)::NUMERIC, 0);

    RETURN jsonb_build_object(
        'eligible', (array_length(v_reasons, 1) IS NULL OR array_length(v_reasons, 1) = 0),
        'reasons', v_reasons,
        'invoice_id', p_invoice_id,
        'invoice_number', COALESCE(v_inv.invoice_number, 'DRAFT'),
        'status', v_inv.status,
        'client_name', COALESCE(v_client.company_name, v_client.contact_person, 'Client'),
        'total_amount', v_total,
        'currency', v_inv.currency,
        'void_date', COALESCE(v_inv.updated_at, v_inv.created_at)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_void_invoice_delete_eligibility(UUID) TO authenticated;

-- 4. Secure PostgreSQL RPC to Permanently Delete Eligible Void Invoice
CREATE OR REPLACE FUNCTION public.permanently_delete_void_invoice(
    p_invoice_id UUID,
    p_reason TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_client RECORD;
    v_user RECORD;
    v_eligibility JSONB;
    v_user_role TEXT;
    v_deleted_reg_id UUID;
    v_snapshot RECORD;
BEGIN
    -- 1. Validate Authenticated User & Super Admin Role
    IF p_user_id IS NOT NULL THEN
        SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id;
        v_user_role := COALESCE(v_user.role_name, '');
    ELSE
        SELECT role_name INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    END IF;

    IF v_user_role <> 'Super Admin' THEN
        RAISE EXCEPTION 'Only Super Admin can permanently delete void invoices. Current role: %', v_user_role;
    END IF;

    -- 2. Lock Invoice Row
    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice with ID % not found.', p_invoice_id;
    END IF;

    -- 3. Confirm Invoice Status is Void
    IF v_inv.status <> 'void' THEN
        RAISE EXCEPTION 'Invoice % cannot be permanently deleted because its status is % (must be void).', 
            COALESCE(v_inv.invoice_number, p_invoice_id::text), v_inv.status;
    END IF;

    -- 4. Check Dependent Financial Tables
    v_eligibility := public.check_void_invoice_delete_eligibility(p_invoice_id);
    IF NOT (v_eligibility->>'eligible')::BOOLEAN THEN
        RAISE EXCEPTION 'This void invoice cannot be permanently deleted because related financial records exist. Archive it instead.';
    END IF;

    -- 5. Validate Reason
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'A deletion reason is required for permanent deletion.';
    END IF;

    -- 6. Resolve Client Information for Register
    SELECT * INTO v_client FROM public.billing_clients WHERE id = v_inv.client_id;

    -- 7. Insert into deleted_invoice_register if a finalized invoice number exists
    IF v_inv.invoice_number IS NOT NULL AND TRIM(v_inv.invoice_number) <> '' THEN
        INSERT INTO public.deleted_invoice_register (
            original_invoice_id,
            organization_id,
            entity_id,
            invoice_number,
            invoice_status,
            client_reference,
            currency,
            total_amount,
            deletion_reason,
            deleted_by,
            deleted_at,
            original_created_at,
            original_finalized_at,
            metadata
        ) VALUES (
            v_inv.id,
            v_inv.organization_id,
            v_inv.entity_id,
            v_inv.invoice_number,
            v_inv.status,
            COALESCE(v_client.company_name, v_client.contact_person, 'Unknown Client'),
            v_inv.currency,
            COALESCE(v_inv.total_payable, 0),
            p_reason,
            COALESCE(p_user_id, auth.uid()),
            now(),
            v_inv.created_at,
            v_inv.approved_at,
            jsonb_build_object('project_name', v_inv.project_name, 'po_number', v_inv.po_number)
        )
        RETURNING id INTO v_deleted_reg_id;
    END IF;

    -- 8. Remove Safe Dependent Records Only
    DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;
    DELETE FROM public.invoice_snapshots WHERE invoice_id = p_invoice_id;
    DELETE FROM public.invoice_public_links WHERE invoice_id = p_invoice_id;

    -- 9. Delete Void Invoice
    DELETE FROM public.invoices WHERE id = p_invoice_id;

    -- 10. Write Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        module,
        record_id,
        previous_value,
        new_value,
        timestamp
    ) VALUES (
        COALESCE(p_user_id, auth.uid(), '00000000-0000-4000-8000-000000000000'),
        'void_invoice_permanently_deleted',
        'invoices',
        p_invoice_id,
        jsonb_build_object(
            'invoice_number', v_inv.invoice_number,
            'status', v_inv.status,
            'client_id', v_inv.client_id,
            'total', v_inv.total_payable
        ),
        jsonb_build_object(
            'deletion_reason', p_reason,
            'deleted_register_id', v_deleted_reg_id,
            'invoice_number_reserved', v_inv.invoice_number
        ),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_number', COALESCE(v_inv.invoice_number, 'DRAFT'),
        'message', 'Void invoice permanently deleted and invoice number preserved in deleted register.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.permanently_delete_void_invoice(UUID, TEXT, UUID) TO authenticated;

-- 5. Archive & Restore RPC Functions
CREATE OR REPLACE FUNCTION public.archive_invoice(
    p_invoice_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice with ID % not found.', p_invoice_id;
    END IF;

    UPDATE public.invoices
    SET archived_at = now(),
        archived_by = COALESCE(p_user_id, auth.uid()),
        archive_reason = p_reason,
        updated_at = now()
    WHERE id = p_invoice_id;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        module,
        record_id,
        previous_value,
        new_value,
        timestamp
    ) VALUES (
        COALESCE(p_user_id, auth.uid(), '00000000-0000-4000-8000-000000000000'),
        'invoice_archived',
        'invoices',
        p_invoice_id,
        jsonb_build_object('archived_at', v_inv.archived_at),
        jsonb_build_object('archived_at', now(), 'archive_reason', p_reason),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_number', v_inv.invoice_number,
        'message', 'Invoice archived successfully.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_invoice(UUID, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_archived_invoice(
    p_invoice_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice with ID % not found.', p_invoice_id;
    END IF;

    UPDATE public.invoices
    SET archived_at = NULL,
        archived_by = NULL,
        archive_reason = NULL,
        updated_at = now()
    WHERE id = p_invoice_id;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        module,
        record_id,
        previous_value,
        new_value,
        timestamp
    ) VALUES (
        COALESCE(p_user_id, auth.uid(), '00000000-0000-4000-8000-000000000000'),
        'invoice_restored',
        'invoices',
        p_invoice_id,
        jsonb_build_object('archived_at', v_inv.archived_at),
        jsonb_build_object('archived_at', NULL),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_number', v_inv.invoice_number,
        'message', 'Archived invoice restored successfully.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_archived_invoice(UUID, UUID) TO authenticated;

-- 6. Add Database Indexes for Server-Side Sorting and Filtering
CREATE INDEX IF NOT EXISTS idx_invoices_created_desc ON public.invoices(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_updated_desc ON public.invoices(updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status_created_desc ON public.invoices(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_entity_created_desc ON public.invoices(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_client_created_desc ON public.invoices(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date_desc ON public.invoices(issue_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date_asc ON public.invoices(due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_invoices_total_payable_desc ON public.invoices(total_payable DESC NULLS LAST);
