CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create Profile
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  -- Create Default Business for the user
  INSERT INTO public.businesses (name)
  VALUES ('My Business')
  RETURNING id INTO v_business_id;

  -- Assign User as OWNER of the business
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (v_business_id, new.id, 'OWNER');

  -- Create Default Inventory Location
  INSERT INTO public.inventory_locations (business_id, name, is_default)
  VALUES (v_business_id, 'Main Store', TRUE);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
