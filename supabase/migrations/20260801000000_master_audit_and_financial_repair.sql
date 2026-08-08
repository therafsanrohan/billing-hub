-- Migration: 20260801000000_master_audit_and_financial_repair.sql
-- Description: Master Audit and Financial Repair for Corevow Billing Hub
-- Fixes: VAT Profiles, Gateway Deductions, Invoice Financial Aggregations, and FK constraints

-- 1. Create VAT Profiles Table
CREATE TABLE IF NOT EXISTS public.vat_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.business_entities(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL DEFAULT '',
    bin_number TEXT NOT NULL DEFAULT '',
    bin_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    vat_registration_type TEXT DEFAULT 'Standard',
    registration_effective_date DATE,
    registration_expiry_date DATE,
    registered_business_activities TEXT DEFAULT '',
    registered_service_codes TEXT DEFAULT '',
    vat_circle TEXT DEFAULT '',
    vat_division TEXT DEFAULT '',
    registered_address TEXT DEFAULT '',
    return_frequency TEXT DEFAULT 'Monthly',
    status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    notes TEXT DEFAULT '',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- RLS for VAT Profiles
ALTER TABLE public.vat_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vat_profiles' AND policyname = 'Allow full access to vat_profiles') THEN
        CREATE POLICY "Allow full access to vat_profiles" ON public.vat_profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 2. Create Gateway Deductions Table
CREATE TABLE IF NOT EXISTS public.gateway_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.invoice_payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    gateway_name TEXT NOT NULL DEFAULT 'Manual',
    gross_payment_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    percentage_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    percentage_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    fixed_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    tax_on_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    currency_conversion_fee NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    bank_charge NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_gateway_deduction NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    net_settlement_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    settlement_currency TEXT NOT NULL DEFAULT 'BDT',
    settlement_date DATE,
    gateway_reference TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- RLS for Gateway Deductions
ALTER TABLE public.gateway_deductions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gateway_deductions' AND policyname = 'Allow full access to gateway_deductions') THEN
        CREATE POLICY "Allow full access to gateway_deductions" ON public.gateway_deductions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 3. Relax recorded_by FK in invoice_payments to allow NULL or system fallbacks
ALTER TABLE public.invoice_payments ALTER COLUMN recorded_by DROP NOT NULL;


-- 4. Create Canonical Invoice Financial Summary View
CREATE OR REPLACE VIEW public.invoice_financial_summary AS
WITH item_totals AS (
    SELECT 
        invoice_id,
        COALESCE(SUM(amount), 0) AS items_subtotal
    FROM public.invoice_items
    GROUP BY invoice_id
),
payment_totals AS (
    SELECT 
        invoice_id,
        COALESCE(SUM(amount), 0) AS total_paid
    FROM public.invoice_payments
    GROUP BY invoice_id
)
SELECT 
    i.id AS invoice_id,
    i.invoice_number,
    i.client_id,
    i.entity_id,
    i.currency,
    i.status,
    i.issue_date,
    i.due_date,
    i.discount_type,
    i.discount_value,
    i.vat_rate,
    i.vat_inclusive,
    COALESCE(it.items_subtotal, 0) AS subtotal,
    CASE 
        WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
        WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
        ELSE 0
    END AS discount_total,
    GREATEST(0, COALESCE(it.items_subtotal, 0) - (
        CASE 
            WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
            WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
            ELSE 0
        END
    )) AS net_service_amount,
    CASE 
        WHEN COALESCE(i.vat_rate, 0) > 0 AND i.vat_inclusive IS TRUE THEN 
            ROUND((
                GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                    CASE 
                        WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                        WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                        ELSE 0
                    END
                )) - (
                    GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                        CASE 
                            WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                            WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                            ELSE 0
                        END
                    )) / (1.0 + (i.vat_rate / 100.0))
                )
            ), 2)
        WHEN COALESCE(i.vat_rate, 0) > 0 AND (i.vat_inclusive IS FALSE OR i.vat_inclusive IS NULL) THEN
            ROUND((
                GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                    CASE 
                        WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                        WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                        ELSE 0
                    END
                )) * (i.vat_rate / 100.0)
            ), 2)
        ELSE 0
    END AS vat_total,
    CASE 
        WHEN COALESCE(i.vat_rate, 0) > 0 AND i.vat_inclusive IS TRUE THEN 
            GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                CASE 
                    WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                    WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                    ELSE 0
                END
            ))
        WHEN COALESCE(i.vat_rate, 0) > 0 AND (i.vat_inclusive IS FALSE OR i.vat_inclusive IS NULL) THEN
            GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                CASE 
                    WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                    WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                    ELSE 0
                END
            )) + ROUND((
                GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                    CASE 
                        WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                        WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                        ELSE 0
                    END
                )) * (i.vat_rate / 100.0)
            ), 2)
        ELSE 
            GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                CASE 
                    WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                    WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                    ELSE 0
                END
            ))
    END AS grand_total,
    COALESCE(pt.total_paid, 0) AS paid_amount,
    GREATEST(0, 
        (CASE 
            WHEN COALESCE(i.vat_rate, 0) > 0 AND i.vat_inclusive IS TRUE THEN 
                GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                    CASE 
                        WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                        WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                        ELSE 0
                    END
                ))
            WHEN COALESCE(i.vat_rate, 0) > 0 AND (i.vat_inclusive IS FALSE OR i.vat_inclusive IS NULL) THEN
                GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                    CASE 
                        WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                        WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                        ELSE 0
                    END
                )) + ROUND((
                    GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                        CASE 
                            WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                            WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                            ELSE 0
                        END
                    )) * (i.vat_rate / 100.0)
                ), 2)
            ELSE 
                GREATEST(0, COALESCE(it.items_subtotal, 0) - (
                    CASE 
                        WHEN i.discount_type = 'fixed' THEN LEAST(COALESCE(it.items_subtotal, 0), COALESCE(i.discount_value, 0))
                        WHEN i.discount_type = 'percentage' THEN ROUND((COALESCE(it.items_subtotal, 0) * LEAST(100, GREATEST(0, COALESCE(i.discount_value, 0)))) / 100.0, 2)
                        ELSE 0
                    END
                ))
        END) - COALESCE(pt.total_paid, 0)
    ) AS outstanding_amount
FROM public.invoices i
LEFT JOIN item_totals it ON i.id = it.invoice_id
LEFT JOIN payment_totals pt ON i.id = pt.invoice_id;
