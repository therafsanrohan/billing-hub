-- 1. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Taxes Table
CREATE TABLE IF NOT EXISTS public.taxes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate_percentage DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Discounts Table
CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PERCENTAGE', 'FIXED')),
  value DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Create Policies (Same as other tables for Business Owners)
CREATE POLICY "Users can view expenses of their business" ON public.expenses FOR SELECT
  USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert expenses of their business" ON public.expenses FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can update expenses of their business" ON public.expenses FOR UPDATE
  USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view taxes of their business" ON public.taxes FOR SELECT
  USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert taxes of their business" ON public.taxes FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can update taxes of their business" ON public.taxes FOR UPDATE
  USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view discounts of their business" ON public.discounts FOR SELECT
  USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert discounts of their business" ON public.discounts FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can update discounts of their business" ON public.discounts FOR UPDATE
  USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
