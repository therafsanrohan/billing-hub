-- Safest trigger for user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_business_id UUID;
  v_location_id UUID;
BEGIN
  -- Insert into profiles safely
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  -- Create Default Business
  INSERT INTO public.businesses (name, currency, timezone)
  VALUES ('My Business', 'BDT', 'Asia/Dhaka')
  RETURNING id INTO v_business_id;

  -- Add User as Owner
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (v_business_id, new.id, 'OWNER'::public.business_role);

  -- Create Default Location
  INSERT INTO public.inventory_locations (business_id, name, is_default)
  VALUES (v_business_id, 'Main Store', true)
  RETURNING id INTO v_location_id;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- If ANYTHING fails in the business logic, still return new so the user is created
    -- Ensure profile exists at the bare minimum if possible, but ignore errors
    BEGIN
      INSERT INTO public.profiles (id, email) VALUES (new.id, new.email) ON CONFLICT DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
