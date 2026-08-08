-- Migration: Expense Deletion Approval, Archiving, Audit Logging, and Extended Tax Profile
-- Date: 2026-08-03

-- 1. Extend expenses table with deletion approval & archiving columns
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deletion_status TEXT DEFAULT 'ACTIVE' CHECK (deletion_status IN ('ACTIVE', 'DELETION_PENDING', 'ARCHIVED'));
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deletion_approved_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deletion_approved_at TIMESTAMP WITH TIME ZONE;

-- 2. Extend vat_registration_profiles and vat_profiles tables with Tax/TIN fields
ALTER TABLE public.vat_registration_profiles ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE public.vat_registration_profiles ADD COLUMN IF NOT EXISTS tax_zone TEXT;
ALTER TABLE public.vat_registration_profiles ADD COLUMN IF NOT EXISTS tax_circle TEXT;
ALTER TABLE public.vat_registration_profiles ADD COLUMN IF NOT EXISTS tax_assessment_year TEXT;
ALTER TABLE public.vat_registration_profiles ADD COLUMN IF NOT EXISTS corporate_tax_rate NUMERIC(5, 2) DEFAULT 30.00;

ALTER TABLE public.vat_profiles ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE public.vat_profiles ADD COLUMN IF NOT EXISTS tax_zone TEXT;
ALTER TABLE public.vat_profiles ADD COLUMN IF NOT EXISTS tax_circle TEXT;
ALTER TABLE public.vat_profiles ADD COLUMN IF NOT EXISTS tax_assessment_year TEXT;
ALTER TABLE public.vat_profiles ADD COLUMN IF NOT EXISTS corporate_tax_rate NUMERIC(5, 2) DEFAULT 30.00;

-- 3. Create index for fast retrieval of pending expense deletion requests
CREATE INDEX IF NOT EXISTS idx_expenses_deletion_status ON public.expenses(deletion_status) WHERE deletion_status != 'ACTIVE';
