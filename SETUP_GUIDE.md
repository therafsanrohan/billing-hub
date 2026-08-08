# Corevow Billing Hub — Setup Guide

This guide details local environment setup, database migrations, and the first Super Admin account configuration.

---

## 1. Project Directory & Environment Configuration

Always run commands inside the application directory:
```bash
cd app-billing-hub-v1
```

### Environment Variables (`.env.local`)
Create `.env.local` inside `app-billing-hub-v1/`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional Local Developer Quick Login Flag (Keep false in Production)
NEXT_PUBLIC_ENABLE_DEV_SANDBOX_LOGIN=false
```

---

## 2. Database Migrations Order

Apply database migrations in the Supabase Dashboard **SQL Editor** in this exact order:

1. `supabase/migrations/20260721000000_initial_schema.sql`
2. `supabase/migrations/20260721000001_functions_and_policies.sql`
3. `supabase/migrations/20260722000000_vat_and_tax_tables.sql`
4. `supabase/migrations/20260723000000_company_reserve_and_savings.sql`
5. `supabase/migrations/20260724000000_cloud_migration_functions_and_rls.sql`
6. `supabase/migrations/20260725000000_fix_cloud_persistence_and_auth.sql`
7. `supabase/migrations/20260726000000_fix_all_rls_recursion.sql`
8. `supabase/migrations/20260727000000_missing_tables.sql`
9. `supabase/migrations/20260728000000_fix_saas_cloud_persistence.sql`

---

## 3. First Super Admin Setup Instructions

For non-technical project owners, follow these exact steps to create your first Super Admin account:

1. Open your **Supabase Project Dashboard** (`https://supabase.com/dashboard`).
2. Navigate to **Authentication** -> **Users**.
3. Click **Add User** -> **Create User**.
4. Enter your email (e.g. `owner@corevow.com`) and a strong password. Click **Create User**.
5. Copy the newly created user's **User UID** (a UUID string like `e1b2c3d4-...`).
6. Navigate to **SQL Editor** in the left menu and run this snippet (replace `<USER_UID>` and `<YOUR_EMAIL>`):

```sql
INSERT INTO public.profiles (id, full_name, email, role_name, is_active, organization_id)
VALUES (
    '<USER_UID>',
    'Super Admin Owner',
    '<YOUR_EMAIL>',
    'super_admin',
    true,
    '00000000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO UPDATE SET 
    role_name = 'super_admin',
    is_active = true;
```

7. You can now log into `https://app-web.vercel.app/login` with your email and password.

---

## 4. Local Development

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run TypeScript typechecks
npx tsc --noEmit
```
