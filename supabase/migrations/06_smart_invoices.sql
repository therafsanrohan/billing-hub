-- 1. Add Smart Invoice Tracking to Businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV-',
  ADD COLUMN IF NOT EXISTS last_invoice_number INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_invoice_date DATE DEFAULT CURRENT_DATE;

-- 2. Update process_pos_order to use Smart Invoices
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
  v_prefix TEXT;
  v_last_num INT;
  v_last_date DATE;
  v_today DATE;
BEGIN
  v_user_id := auth.uid();
  v_today := CURRENT_DATE;
  
  -- Smart Invoice Generation with Lock
  SELECT invoice_prefix, last_invoice_number, last_invoice_date 
  INTO v_prefix, v_last_num, v_last_date
  FROM public.businesses
  WHERE id = p_business_id
  FOR UPDATE; -- Lock row to prevent race conditions

  IF v_last_date != v_today THEN
    -- Reset sequence for new day
    v_last_num := 1;
  ELSE
    v_last_num := v_last_num + 1;
  END IF;

  -- Format: INV-231024-0001 (YYMMDD)
  v_order_num := COALESCE(v_prefix, 'INV-') || to_char(v_today, 'YYMMDD') || '-' || lpad(v_last_num::text, 4, '0');

  -- Update Business sequence
  UPDATE public.businesses
  SET last_invoice_number = v_last_num, last_invoice_date = v_today
  WHERE id = p_business_id;

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

  -- 2. Insert Order Items and Update Inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert order item
    INSERT INTO public.order_items (
      order_id, product_id, variant_id,
      quantity, unit_price, discount_amount, total_price
    ) VALUES (
      v_order_id, 
      (v_item->>'product_id')::UUID,
      NULLIF(v_item->>'variant_id', '')::UUID,
      (v_item->>'qty')::INT,
      (v_item->>'price')::NUMERIC,
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      ((v_item->>'qty')::INT * (v_item->>'price')::NUMERIC) - COALESCE((v_item->>'discount')::NUMERIC, 0)
    );

    -- Update inventory via movement
    INSERT INTO public.inventory_movements (
      business_id, location_id, product_id, variant_id,
      movement_type, quantity, reference_type, reference_id
    ) VALUES (
      p_business_id, 
      p_location_id, 
      (v_item->>'product_id')::UUID,
      NULLIF(v_item->>'variant_id', '')::UUID,
      'OUT', 
      (v_item->>'qty')::INT,
      'SALE',
      v_order_id
    );
  END LOOP;

  -- 3. Insert Payment
  INSERT INTO public.payments (
    order_id, payment_method, amount, status, processed_by
  ) VALUES (
    v_order_id, 
    p_payment_method, 
    p_payment_amount, 
    'COMPLETED',
    v_user_id
  );

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
