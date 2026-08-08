-- 1. Add BIN column to businesses table
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS bin TEXT;
