-- Sprint 1: Products & Inventory

-- 1. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access categories of their business"
  ON public.categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = categories.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 2. Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  image_url TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_price NUMERIC(14,2),
  low_stock_level INT NOT NULL DEFAULT 5,
  has_variants BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, sku)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access products of their business"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = products.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 3. Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  cost_price NUMERIC(14,2),
  selling_price NUMERIC(14,2),
  low_stock_level INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, sku)
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access variants of their business"
  ON public.product_variants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = product_variants.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 4. Inventory Locations
CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access locations of their business"
  ON public.inventory_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = inventory_locations.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 5. Inventory Movements
CREATE TYPE public.movement_type AS ENUM (
  'PURCHASE',
  'SALE',
  'RETURN',
  'DAMAGE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'OPENING_STOCK',
  'TRANSFER_IN',
  'TRANSFER_OUT'
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  movement_type public.movement_type NOT NULL,
  quantity INT NOT NULL, -- Positive for IN, Negative for OUT
  reference_type TEXT, -- e.g., 'SALE', 'PURCHASE'
  reference_id UUID, -- Links to sale_id or purchase_id
  unit_cost NUMERIC(14,2),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access movements of their business"
  ON public.inventory_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = inventory_movements.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 6. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant ON public.inventory_movements(variant_id);

-- 7. SQL Function to calculate current stock from ledger
CREATE OR REPLACE FUNCTION public.get_current_stock(
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_stock INT;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_stock
  FROM public.inventory_movements
  WHERE product_id = p_product_id
  AND (p_variant_id IS NULL OR variant_id = p_variant_id)
  AND (p_location_id IS NULL OR location_id = p_location_id);
  
  RETURN v_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
