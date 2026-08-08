-- Sprint 2: Orders & Payments

-- 1. Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  total_spent NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access customers of their business"
  ON public.customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = customers.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 2. Orders
CREATE TYPE public.order_status AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE public.payment_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED');

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL, -- e.g., INV-2023-0001
  status public.order_status NOT NULL DEFAULT 'COMPLETED',
  payment_status public.payment_status NOT NULL DEFAULT 'PAID',
  
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  delivery_charge NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, order_number)
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access orders of their business"
  ON public.orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = orders.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 3. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL, -- (quantity * unit_price) - discount
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access order items of their business"
  ON public.order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      JOIN public.business_members ON business_members.business_id = orders.business_id
      WHERE orders.id = order_items.order_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 4. Payments
CREATE TYPE public.payment_method AS ENUM ('CASH', 'BKASH', 'NAGAD', 'CARD', 'BANK_TRANSFER');

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'CASH',
  reference_number TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access payments of their business"
  ON public.payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members
      WHERE business_members.business_id = payments.business_id
      AND business_members.user_id = auth.uid()
    )
  );

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_business ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);

-- 6. POS Order Processing RPC
CREATE OR REPLACE FUNCTION public.process_pos_order(
  p_business_id UUID,
  p_location_id UUID,
  p_customer_id UUID,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_tax NUMERIC,
  p_delivery NUMERIC,
  p_total NUMERIC,
  p_items JSONB, -- Array of { product_id, variant_id, qty, price, discount }
  p_payment_method TEXT,
  p_payment_amount NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_order_num TEXT;
  v_item JSONB;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Generate simple order number
  v_order_num := 'ORD-' || to_char(NOW(), 'YYYYMMDD-HH24MISS');

  -- 1. Insert Order
  INSERT INTO public.orders (
    business_id, location_id, customer_id, order_number,
    subtotal, discount_amount, tax_amount, delivery_charge, total_amount,
    created_by
  ) VALUES (
    p_business_id, p_location_id, p_customer_id, v_order_num,
    p_subtotal, p_discount, p_tax, p_delivery, p_total,
    v_user_id
  ) RETURNING id INTO v_order_id;

  -- 2. Insert Items & Inventory Movements
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert Order Item
    INSERT INTO public.order_items (
      order_id, product_id, variant_id, quantity, unit_price, discount_amount, subtotal
    ) VALUES (
      v_order_id, 
      (v_item->>'product_id')::UUID, 
      NULLIF(v_item->>'variant_id', '')::UUID,
      (v_item->>'qty')::INT, 
      (v_item->>'price')::NUMERIC, 
      (v_item->>'discount')::NUMERIC,
      ((v_item->>'qty')::INT * (v_item->>'price')::NUMERIC) - (v_item->>'discount')::NUMERIC
    );

    -- Deduct Inventory
    INSERT INTO public.inventory_movements (
      business_id, location_id, product_id, variant_id,
      movement_type, quantity, reference_type, reference_id, created_by
    ) VALUES (
      p_business_id, p_location_id, 
      (v_item->>'product_id')::UUID, 
      NULLIF(v_item->>'variant_id', '')::UUID,
      'SALE', -(v_item->>'qty')::INT, 'SALE', v_order_id, v_user_id
    );
  END LOOP;

  -- 3. Insert Payment
  IF p_payment_amount > 0 THEN
    INSERT INTO public.payments (
      business_id, order_id, amount, method, created_by
    ) VALUES (
      p_business_id, v_order_id, p_payment_amount, p_payment_method::public.payment_method, v_user_id
    );
  END IF;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
