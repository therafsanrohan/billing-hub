-- Corrective Migration: Fix Cloud Database Persistence, Canonical Roles, and Idempotent Policies

-- 1. UPDATE ROLE CHECK CONSTRAINT ON PROFILES
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_name_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_name_check CHECK (
    role_name IN (
        'Super Admin', 'super_admin',
        'Admin', 'admin',
        'Finance Admin', 'finance', 'finance_admin',
        'Client Service', 'client_service',
        'Project Manager', 'project_manager',
        'Viewer', 'viewer'
    )
);

-- 2. AUTOMATIC PROFILE CREATION TRIGGER ON SUPABASE AUTH SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role_name, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role_name', 'Super Admin'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger on auth.users if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 3. ENSURE RLS HELPER FUNCTION & NON-RECURSIVE PROFILES POLICIES
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role_name IN ('Super Admin', 'super_admin', 'Admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_finance_authorized()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role_name IN ('Super Admin', 'super_admin', 'Admin', 'admin', 'Finance Admin', 'finance', 'finance_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Idempotent Non-Recursive RLS Policies for Profiles
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Users can read all profiles" ON profiles 
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert profiles" ON profiles 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users or admins can update profiles" ON profiles 
    FOR UPDATE USING (auth.uid() = id OR public.is_admin_user());

CREATE POLICY "Admins can delete profiles" ON profiles 
    FOR DELETE USING (public.is_admin_user());

-- 4. GRANT TABLE PERMISSIONS TO AUTHENTICATED USERS
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
