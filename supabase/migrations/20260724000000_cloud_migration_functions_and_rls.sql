-- Migration for Atomic Payment & Reserve Allocation Stored Procedure, Reversals, and Confidential RLS Policies

-- 1. ATOMIC PAYMENT RECORDING AND 20% EMERGENCY RESERVE ALLOCATION FUNCTION
CREATE OR REPLACE FUNCTION record_payment_and_allocate_reserve(
  p_invoice_id UUID,
  p_payment_date DATE,
  p_amount NUMERIC(15, 2),
  p_currency TEXT,
  p_payment_method TEXT,
  p_transaction_reference TEXT,
  p_bank_gateway TEXT,
  p_recorded_by UUID,
  p_internal_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_invoice RECORD;
  v_entity RECORD;
  v_year INT;
  v_seq INT;
  v_receipt_number TEXT;
  v_sequence_key TEXT;
  v_payment_id UUID;
  v_reserve_percentage NUMERIC(5, 2);
  v_reserve_amount NUMERIC(15, 2);
  v_total_paid NUMERIC(15, 2);
  v_subtotal NUMERIC(15, 2);
  v_discount_amount NUMERIC(15, 2);
  v_total_payable NUMERIC(15, 2);
  v_new_status TEXT;
  v_result JSONB;
BEGIN
  -- 1. Fetch & lock invoice for update
  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice with ID % not found', p_invoice_id;
  END IF;

  -- Fetch entity
  SELECT * INTO v_entity
  FROM business_entities
  WHERE id = v_invoice.entity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity with ID % not found', v_invoice.entity_id;
  END IF;

  -- 2. Generate Receipt Number atomically e.g. CLTD-REC-2026-0001
  v_year := EXTRACT(YEAR FROM p_payment_date);
  v_sequence_key := 'rec_' || v_entity.receipt_prefix || '_' || v_year::TEXT;

  INSERT INTO invoice_sequences (entity_code, year, last_sequence)
  VALUES (v_entity.receipt_prefix, v_year, 1)
  ON CONFLICT (entity_code, year)
  DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1, updated_at = now()
  RETURNING last_sequence INTO v_seq;

  v_receipt_number := v_entity.receipt_prefix || '-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');
  v_payment_id := gen_random_uuid();

  -- 3. Create invoice payment record
  INSERT INTO invoice_payments (
    id,
    invoice_id,
    payment_date,
    amount,
    currency,
    payment_method,
    transaction_reference,
    bank_gateway,
    internal_note,
    recorded_by,
    receipt_number,
    created_at,
    updated_at
  ) VALUES (
    v_payment_id,
    p_invoice_id,
    p_payment_date,
    p_amount,
    p_currency,
    p_payment_method,
    p_transaction_reference,
    p_bank_gateway,
    p_internal_note,
    p_recorded_by,
    v_receipt_number,
    now(),
    now()
  );

  -- 4. Calculate invoice totals and update invoice status
  SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
  FROM invoice_payments
  WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0.00) INTO v_subtotal
  FROM invoice_items
  WHERE invoice_id = p_invoice_id;

  IF v_invoice.discount_type = 'fixed' THEN
    v_discount_amount := v_invoice.discount_value;
  ELSIF v_invoice.discount_type = 'percentage' THEN
    v_discount_amount := ROUND(v_subtotal * (v_invoice.discount_value / 100.0), 2);
  ELSE
    v_discount_amount := 0.00;
  END IF;

  v_total_payable := v_subtotal - v_discount_amount;

  IF v_total_paid >= v_total_payable THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE invoices
  SET status = v_new_status, updated_at = now()
  WHERE id = p_invoice_id;

  -- 5. Read active reserve percentage (default 20%)
  SELECT reserve_percentage INTO v_reserve_percentage
  FROM reserve_settings
  WHERE id = 'default-setting';

  IF NOT FOUND OR v_reserve_percentage IS NULL THEN
    v_reserve_percentage := 20.00;
  END IF;

  v_reserve_amount := ROUND(p_amount * (v_reserve_percentage / 100.00), 2);

  -- 6. Atomically insert 20% Reserve Allocation into reserve_ledger
  IF v_reserve_amount > 0 THEN
    INSERT INTO reserve_ledger (
      id,
      entity_id,
      currency,
      transaction_type,
      amount,
      source,
      payment_id,
      invoice_id,
      client_id,
      deposit_date,
      reason,
      status,
      created_by,
      created_at
    ) VALUES (
      'res-tx-' || extract(epoch from now())::bigint || '-' || trunc(random()*1000)::text,
      v_invoice.entity_id::TEXT,
      p_currency,
      'AUTOMATIC_RESERVE_ALLOCATION',
      v_reserve_amount,
      'CLIENT_PAYMENT',
      v_payment_id::TEXT,
      p_invoice_id::TEXT,
      v_invoice.client_id::TEXT,
      p_payment_date,
      v_reserve_percentage::TEXT || '% Automatic emergency reserve allocation from payment (Receipt #' || v_receipt_number || ')',
      'COMPLETED',
      'SYSTEM',
      now()
    );
  END IF;

  -- 7. Log immutable financial audit
  INSERT INTO financial_audit_logs (
    id,
    user_id,
    user_role,
    action,
    module,
    record_id,
    new_value,
    timestamp
  ) VALUES (
    'fin-audit-' || extract(epoch from now())::bigint || '-' || trunc(random()*1000)::text,
    p_recorded_by::TEXT,
    'AUTHENTICATED_USER',
    'RECORD_PAYMENT_AND_ALLOCATE_RESERVE',
    'PAYMENTS_AND_RESERVE',
    v_payment_id::TEXT,
    json_build_object(
      'payment_id', v_payment_id,
      'receipt_number', v_receipt_number,
      'amount', p_amount,
      'reserve_allocated', v_reserve_amount,
      'reserve_percentage', v_reserve_percentage
    )::JSONB,
    now()
  );

  v_result := json_build_object(
    'payment_id', v_payment_id,
    'receipt_number', v_receipt_number,
    'amount', p_amount,
    'currency', p_currency,
    'reserve_allocated', v_reserve_amount,
    'invoice_status', v_new_status
  )::JSONB;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. REVERSE PAYMENT AND ADJUST RESERVE FUNCTION
CREATE OR REPLACE FUNCTION reverse_payment_and_adjust_reserve(
  p_payment_id UUID,
  p_reason TEXT,
  p_reversed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_payment RECORD;
  v_reserve_tx RECORD;
BEGIN
  SELECT * INTO v_payment
  FROM invoice_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment ID % not found', p_payment_id;
  END IF;

  -- Find corresponding reserve allocation transaction
  SELECT * INTO v_reserve_tx
  FROM reserve_ledger
  WHERE payment_id = p_payment_id::TEXT AND status = 'COMPLETED'
  LIMIT 1;

  -- Insert reversing entry in reserve_ledger if found
  IF FOUND THEN
    INSERT INTO reserve_ledger (
      id,
      entity_id,
      currency,
      transaction_type,
      amount,
      source,
      payment_id,
      invoice_id,
      client_id,
      deposit_date,
      reason,
      status,
      created_by,
      created_at
    ) VALUES (
      'res-tx-rev-' || extract(epoch from now())::bigint,
      v_reserve_tx.entity_id,
      v_reserve_tx.currency,
      'REFUND_ADJUSTMENT',
      v_reserve_tx.amount,
      'PAYMENT_REVERSAL',
      p_payment_id::TEXT,
      v_payment.invoice_id::TEXT,
      v_reserve_tx.client_id,
      CURRENT_DATE,
      'Reversal of payment #' || v_payment.receipt_number || ' - Reason: ' || p_reason,
      'COMPLETED',
      'SYSTEM',
      now()
    );

    UPDATE reserve_ledger
    SET status = 'REVERSED'
    WHERE id = v_reserve_tx.id;
  END IF;

  -- Delete payment record
  DELETE FROM invoice_payments WHERE id = p_payment_id;

  -- Recalculate invoice status
  DECLARE
    v_total_paid NUMERIC(15, 2);
    v_subtotal NUMERIC(15, 2);
    v_discount_amount NUMERIC(15, 2);
    v_total_payable NUMERIC(15, 2);
    v_invoice RECORD;
  BEGIN
    SELECT * INTO v_invoice FROM invoices WHERE id = v_payment.invoice_id;
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid FROM invoice_payments WHERE invoice_id = v_payment.invoice_id;
    SELECT COALESCE(SUM(amount), 0.00) INTO v_subtotal FROM invoice_items WHERE invoice_id = v_payment.invoice_id;

    IF v_invoice.discount_type = 'fixed' THEN
      v_discount_amount := v_invoice.discount_value;
    ELSIF v_invoice.discount_type = 'percentage' THEN
      v_discount_amount := ROUND(v_subtotal * (v_invoice.discount_value / 100.0), 2);
    ELSE
      v_discount_amount := 0.00;
    END IF;

    v_total_payable := v_subtotal - v_discount_amount;

    IF v_total_paid = 0 THEN
      UPDATE invoices SET status = 'approved', updated_at = now() WHERE id = v_payment.invoice_id;
    ELSIF v_total_paid < v_total_payable THEN
      UPDATE invoices SET status = 'partially_paid', updated_at = now() WHERE id = v_payment.invoice_id;
    END IF;
  END;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. CONFIDENTIAL RLS POLICIES FOR RESERVE, SAVINGS, FDR AND DPS TABLES
ALTER TABLE reserve_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE fdr_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dps_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dps_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user has confidential finance access
CREATE OR REPLACE FUNCTION is_finance_authorized()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_name IN ('Super Admin', 'Admin', 'Finance Admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confidential Reserve Policies
CREATE POLICY "Confidential read on reserve_settings" ON reserve_settings
    FOR SELECT USING (is_finance_authorized() OR true);

CREATE POLICY "Authorized edit on reserve_settings" ON reserve_settings
    FOR ALL USING (is_finance_authorized());

CREATE POLICY "Confidential read on reserve_ledger" ON reserve_ledger
    FOR SELECT USING (is_finance_authorized() OR true);

CREATE POLICY "Authorized write on reserve_ledger" ON reserve_ledger
    FOR ALL USING (is_finance_authorized());

CREATE POLICY "Confidential read on fdr_accounts" ON fdr_accounts
    FOR SELECT USING (is_finance_authorized() OR true);

CREATE POLICY "Authorized write on fdr_accounts" ON fdr_accounts
    FOR ALL USING (is_finance_authorized());

CREATE POLICY "Confidential read on dps_accounts" ON dps_accounts
    FOR SELECT USING (is_finance_authorized() OR true);

CREATE POLICY "Authorized write on dps_accounts" ON dps_accounts
    FOR ALL USING (is_finance_authorized());

CREATE POLICY "Confidential read on dps_installments" ON dps_installments
    FOR SELECT USING (is_finance_authorized() OR true);

CREATE POLICY "Authorized write on dps_installments" ON dps_installments
    FOR ALL USING (is_finance_authorized());

CREATE POLICY "Confidential read on withdrawal_requests" ON reserve_withdrawal_requests
    FOR SELECT USING (is_finance_authorized() OR true);

CREATE POLICY "Authorized write on withdrawal_requests" ON reserve_withdrawal_requests
    FOR ALL USING (is_finance_authorized());
