-- Add postal_code column to business_entities table
ALTER TABLE public.business_entities ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Update default values for existing entities
UPDATE public.business_entities
SET postal_code = '1213'
WHERE entity_code = 'CLTD' AND (postal_code IS NULL OR postal_code = '');

UPDATE public.business_entities
SET postal_code = '10019'
WHERE entity_code = 'CLLC' AND (postal_code IS NULL OR postal_code = '');
