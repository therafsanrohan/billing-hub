-- Corrective Referential Integrity & Atomic RPC Migration
-- Date: 2026-07-27

-- 1. Ensure canonical Business Entities exist with unique entity_code constraint
ALTER TABLE public.business_entities ADD CONSTRAINT business_entities_entity_code_key UNIQUE (entity_code);

INSERT INTO public.business_entities (
    id, legal_name, entity_code, registered_address, registration_number, tax_id, email, phone, website, invoice_prefix, receipt_prefix, vat_footer, corporate_tax_rate, default_vat_rate
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Corevow Limited',
    'CLTD',
    'House 12, Road 4, Banani, Dhaka 1213, Bangladesh',
    'C-CLTD-DHAKA-2026',
    'TIN-BIN-CLTD-123456',
    'billing@corevow.com',
    '+880 1325 078 941',
    'www.corevow.com',
    'CLTD-BDT',
    'CLTD-REC',
    'All rates are inclusive of applicable VAT in accordance with prevailing laws.',
    30.00,
    15.00
),
(
    '22222222-2222-2222-2222-222222222222',
    'Corevow LLC',
    'CLLC',
    '1619 Broadway, Suite 500, New York, NY 10019, USA',
    'NY-CLLC-2026-98765',
    'EIN-12-3456789',
    'billing@corevow.com',
    '+1 212 555 0199',
    'www.corevow.com',
    'CLLC-USD',
    'CLLC-REC',
    'All rates are inclusive of applicable taxes.',
    21.00,
    0.00
)
ON CONFLICT (entity_code) DO UPDATE SET
    legal_name = EXCLUDED.legal_name,
    registered_address = EXCLUDED.registered_address,
    invoice_prefix = EXCLUDED.invoice_prefix;

-- 2. Atomic Invoice Creation RPC Function
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
    v_created_by := (p_invoice->>'created_by')::uuid;

    -- Validate Foreign Key Parent Existence
    IF NOT EXISTS (SELECT 1 FROM public.business_entities WHERE id = v_entity_id) THEN
        RAISE EXCEPTION 'Foreign Key Failure: Entity ID % does not exist in business_entities', v_entity_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = v_client_id) THEN
        RAISE EXCEPTION 'Foreign Key Failure: Client ID % does not exist in clients', v_client_id;
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
        (p_invoice->>'vat_inclusive')::boolean,
        p_invoice->>'client_note',
        p_invoice->>'payment_instructions',
        p_invoice->>'terms_conditions',
        p_invoice->>'internal_note',
        v_created_by,
        COALESCE((p_invoice->>'created_at')::timestamptz, now()),
        COALESCE((p_invoice->>'updated_at')::timestamptz, now())
    );

    -- Insert Invoice Line Items
    IF jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO public.invoice_items (
                id, invoice_id, service_name, description, quantity, rate, amount, sort_order
            ) VALUES (
                (v_item->>'id')::uuid,
                v_invoice_id,
                v_item->>'service_name',
                v_item->>'description',
                (v_item->>'quantity')::numeric,
                (v_item->>'rate')::numeric,
                (v_item->>'amount')::numeric,
                (v_item->>'sort_order')::integer
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice_id);
END;
$$;
