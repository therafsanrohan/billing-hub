# Deployment, Backup & Rollback Guide

This document details Vercel production deployment, Supabase Auth URL configuration, legacy data backup/restore, and database rollback procedures.

---

## 1. Vercel Production Deployment

### Project Settings
- **GitHub Repository**: `therafsanrohan/app_web`
- **Root Directory**: `app-billing-hub-v1`
- **Framework Preset**: Next.js

### Required Vercel Environment Variables
Set these in Vercel -> Project Settings -> **Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_APP_URL=https://app-web.vercel.app
NEXT_PUBLIC_ENABLE_DEV_SANDBOX_LOGIN=false
```

---

## 2. Supabase Auth Redirect URLs

In **Supabase Dashboard** -> **Authentication** -> **URL Configuration**:

- **Site URL**: `https://app-web.vercel.app`
- **Redirect URLs**:
  - `https://app-web.vercel.app/billing`
  - `https://app-web.vercel.app/login`
  - `https://app-web.vercel.app/reset-password`
  - `http://localhost:3000/billing`

---

## 3. Legacy Data Export & Reconciliation

If team members have historical records stored in browser `localStorage`:

1. Log in as Super Admin.
2. Navigate to **Settings** -> **Cloud Migration** (`/billing/settings/cloud-migration`).
3. Click **Export Device JSON Backup** to save a timestamped backup JSON file.
4. On any new device, click **Import Backup File** to validate and reconcile records into Supabase PostgreSQL.
5. After verifying records in Supabase, type `CLEAR LEGACY DATA` to clear local browser storage.

---

## 4. Cross-Device Acceptance Verification

To confirm cross-device cloud persistence:

1. Log in on Desktop (`https://app-web.vercel.app/login`).
2. Create a Client named `Cloud Verification Client`.
3. Log in on Mobile with the same account.
4. Verify `Cloud Verification Client` appears on mobile immediately.
5. Record a BDT 100,000 payment from mobile.
6. Verify BDT 20,000 is automatically allocated to Reserve and BDT 80,000 to Operating Cash on desktop.
7. Clear browser storage on mobile and refresh. Verify all records remain intact in Supabase PostgreSQL.

---

## 5. Database Backup & Rollback Process

### Manual PostgreSQL Backup
In Supabase Dashboard -> **Database** -> **Backups**:
- Click **Take Backup Now** prior to running major schema updates.

### Rollback Process
If a migration needs to be rolled back:
1. Restore the latest automated point-in-time snapshot from Supabase Dashboard.
2. Re-apply verified migration scripts up to `20260728000000_fix_saas_cloud_persistence.sql`.
