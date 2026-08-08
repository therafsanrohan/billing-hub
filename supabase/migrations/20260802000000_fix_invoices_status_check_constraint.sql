-- Migration: Fix invoices status CHECK constraint
-- Date: 2026-08-02
-- Problem: invoices_status_check does not include 'rejected' and 'cancelled'
--          causing db.rejectInvoice() to fail with:
--          "new row for relation "invoices" violates check constraint "invoices_status_check""

-- Drop the old constraint
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Re-add with the full set of valid statuses including 'rejected' and 'cancelled'
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check CHECK (
    status IN (
      'draft',
      'pending_approval',
      'approved',
      'sent',
      'viewed',
      'partially_paid',
      'paid',
      'overdue',
      'void',
      'rejected',
      'cancelled'
    )
  );
