-- Sprint 3: Expenses

-- 1. Expense Categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, name)
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access expense categories of their business"
  ON public.expense_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = expense_categories.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 2. Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access expenses of their business"
  ON public.expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = expenses.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 3. Trigger for updating updated_at on expenses
CREATE TRIGGER update_expenses_modtime
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Seed some default expense categories when a business is created
-- We can do this in the app logic or here, but for now we'll let the user create them.
