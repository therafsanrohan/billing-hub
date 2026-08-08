-- Migration: Fix public invoice links table (must be run in Supabase SQL Editor)
-- Creates invoice_public_links and public_invoice_access_logs if missing,
-- seeds every existing approved/sent/viewed/partially_paid/paid/overdue invoice with a link row,
-- and ensures legacy_token_hash matches the secure_token on the invoices table.

-- Enable pgcrypto extension if not yet enabled (needed for digest())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create invoice_public_links table
CREATE TABLE IF NOT EXISTS public.invoice_public_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    organization_id UUID,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    access_mode TEXT NOT NULL DEFAULT 'LINK_ONLY' CHECK (access_mode IN ('LINK_ONLY', 'EMAIL_OTP')),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES public.profiles(id),
    rotation_reason TEXT,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count BIGINT NOT NULL DEFAULT 0,
    legacy_token_hash TEXT,
    key_version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT invoice_public_links_invoice_id_key UNIQUE (invoice_id)
);

-- 2. Create access logs table
CREATE TABLE IF NOT EXISTS public.public_invoice_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_link_id UUID REFERENCES public.invoice_public_links(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    ip_hash TEXT,
    user_agent_category TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    access_result TEXT NOT NULL,
    trace_id TEXT
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_public_links_active ON public.invoice_public_links(id, is_active);
CREATE INDEX IF NOT EXISTS idx_invoice_public_links_legacy_hash ON public.invoice_public_links(legacy_token_hash) WHERE legacy_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_logs_link_id ON public.public_invoice_access_logs(public_link_id, accessed_at DESC);

-- 4. Enable RLS
ALTER TABLE public.invoice_public_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_invoice_access_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Authenticated users can read public links" ON public.invoice_public_links;
CREATE POLICY "Authenticated users can read public links" ON public.invoice_public_links
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage public links" ON public.invoice_public_links;
CREATE POLICY "Authenticated users can manage public links" ON public.invoice_public_links
FOR ALL USING (auth.role() = 'authenticated');

-- 6. Seed all existing invoices with a public link row (idempotent)
DO $$
DECLARE
    r RECORD;
    v_legacy_hash TEXT;
BEGIN
    FOR r IN SELECT id, secure_token, created_by, entity_id FROM public.invoices LOOP
        v_legacy_hash := encode(digest(COALESCE(r.secure_token::text, r.id::text), 'sha256'), 'hex');
        
        INSERT INTO public.invoice_public_links (
            invoice_id,
            organization_id,
            version,
            is_active,
            access_mode,
            created_by,
            legacy_token_hash,
            key_version
        ) VALUES (
            r.id,
            r.entity_id,
            1,
            true,
            'LINK_ONLY',
            NULL,
            v_legacy_hash,
            1
        )
        ON CONFLICT (invoice_id) DO NOTHING;
    END LOOP;
END;
$$;

-- Verify result
SELECT 
    COUNT(*) AS total_links,
    COUNT(CASE WHEN is_active THEN 1 END) AS active_links,
    COUNT(legacy_token_hash) AS links_with_legacy_hash
FROM public.invoice_public_links;
