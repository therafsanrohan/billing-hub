-- Update trigger to automatically create a business and inventory location when a user signs up

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_business_id UUID;
  v_location_id UUID;
BEGIN
  -- 1. Create Profile first (if this fails, the user signup fails normally)
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  BEGIN
    -- 2. Create Default Business
    INSERT INTO public.businesses (name, currency, timezone)
    VALUES ('My Business', 'BDT', 'Asia/Dhaka')
    RETURNING id INTO v_business_id;

    -- 3. Add User as Owner
    INSERT INTO public.business_members (business_id, user_id, role)
    VALUES (v_business_id, new.id, 'OWNER'::public.business_role);

    -- 4. Create Default Location
    INSERT INTO public.inventory_locations (business_id, name, is_default)
    VALUES (v_business_id, 'Main Store', true)
    RETURNING id INTO v_location_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- If business setup fails, just ignore it and let the user login.
      -- They won't have a business, but at least auth works.
      NULL;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
