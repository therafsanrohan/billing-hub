-- Sprint: Settings & Features

-- 1. Add Receipt Settings to Businesses
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS receipt_header TEXT,
  ADD COLUMN IF NOT EXISTS receipt_footer TEXT,
  ADD COLUMN IF NOT EXISTS receipt_message TEXT;

-- 2. Add Preferences to Profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
