-- Stored Procedures, Triggers, and RLS Policies for Corevow Billing Hub V1

-- 1. ATOMIC SEQUENCE & INVOICE NUMBER GENERATION FUNCTION
CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_invoice_id UUID,
  p_approved_by_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_currency TEXT;
  v_entity_code TEXT;
  v_year INT;
  v_seq INT;
  v_invoice_number TEXT;
  v_entity_id UUID;
  v_client_id UUID;
  v_issue_date DATE;
  v_discount_type TEXT;
  v_discount_value NUMERIC(12, 2);
  v_vat_rate NUMERIC(5, 2);
  v_vat_inclusive BOOLEAN;
  v_subtotal NUMERIC(12, 2);
  v_discount_amount NUMERIC(12, 2);
  v_total_payable NUMERIC(12, 2);
  
  v_entity_row RECORD;
  v_bank_row RECORD;
  v_client_row RECORD;
BEGIN
  -- Fetch invoice, lock row for update to prevent concurrent race conditions
  SELECT client_id, currency, entity_id, issue_date, discount_type, discount_value, vat_rate, vat_inclusive
  INTO v_client_id, v_currency, v_entity_id, v_issue_date, v_discount_type, v_discount_value, v_vat_rate, v_vat_inclusive
  FROM invoices
  WHERE id = p_invoice_id AND (status = 'pending_approval' OR status = 'draft')
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice is not in pending_approval/draft status or does not exist';
  END IF;
  
  -- Determine entity code
  SELECT entity_code INTO v_entity_code
  FROM business_entities
  WHERE id = v_entity_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business entity not found';
  END IF;
  
  -- Extract year from issue date
  v_year := EXTRACT(YEAR FROM v_issue_date);
  
  -- Increment sequence atomically, using row lock for sequence matching entity and year
  INSERT INTO invoice_sequences (entity_code, year, last_sequence)
  VALUES (v_entity_code, v_year, 1)
  ON CONFLICT (entity_code, year)
  DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1, updated_at = now()
  RETURNING last_sequence INTO v_seq;
  
  -- Format invoice number
  v_invoice_number := v_entity_code || '-' || v_currency || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  
  -- Perform decimal-safe calculations of totals
  SELECT COALESCE(SUM(amount), 0.00) INTO v_subtotal
  FROM invoice_items
  WHERE invoice_id = p_invoice_id;
  
  IF v_discount_type = 'fixed' THEN
    v_discount_amount := v_discount_value;
  ELSIF v_discount_type = 'percentage' THEN
    v_discount_amount := ROUND(v_subtotal * (v_discount_value / 100.0), 2);
  ELSE
    v_discount_amount := 0.00;
  END IF;
  
  IF v_discount_amount > v_subtotal THEN
    v_discount_amount := v_subtotal;
  END IF;
  
  v_total_payable := v_subtotal - v_discount_amount;
  
  -- Fetch snapshots
  SELECT legal_name, registered_address, registration_number, tax_id, email, phone, website
  INTO v_entity_row
  FROM business_entities
  WHERE id = v_entity_id;
  
  SELECT bank_name, account_holder, account_number, branch, routing_number, swift_bic, bank_address
  INTO v_bank_row
  FROM entity_bank_accounts
  WHERE entity_id = v_entity_id AND is_active = true
  LIMIT 1;
  
  SELECT company_name, contact_person, billing_email, billing_address, phone, tax_number
  INTO v_client_row
  FROM billing_clients
  WHERE id = v_client_id;
  
  -- Create historical static snapshots
  INSERT INTO invoice_snapshots (
    invoice_id,
    entity_snapshot,
    bank_snapshot,
    client_snapshot,
    totals_snapshot
  ) VALUES (
    p_invoice_id,
    row_to_json(v_entity_row)::JSONB,
    row_to_json(v_bank_row)::JSONB,
    row_to_json(v_client_row)::JSONB,
    json_build_object(
      'subtotal', v_subtotal,
      'discount_amount', v_discount_amount,
      'total_payable', v_total_payable,
      'amount_paid', 0.00,
      'amount_due', v_total_payable
    )::JSONB
  );
  
  -- Finalize invoice details
  UPDATE invoices
  SET 
    invoice_number = v_invoice_number,
    status = 'approved',
    approved_by = p_approved_by_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_invoice_id;
  
  -- Write system audit log
  INSERT INTO billing_audit_logs (user_id, action, module, record_id, previous_value, new_value)
  VALUES (
    p_approved_by_id,
    'approve_invoice',
    'invoices',
    p_invoice_id::TEXT,
    json_build_object('status', 'draft')::JSONB,
    json_build_object('status', 'approved', 'invoice_number', v_invoice_number)::JSONB
  );
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;


-- 2. ROW LEVEL SECURITY (RLS) STATE
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;

-- 3. PROFILE POLICIES
CREATE POLICY "Users can read all profiles" ON profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Super Admins can manage all profiles" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );

-- 4. BUSINESS ENTITY POLICIES
CREATE POLICY "Authenticated users can read business entities" ON business_entities
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Super Admins can manage business entities" ON business_entities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );

-- 5. BANK ACCOUNT POLICIES
CREATE POLICY "Authenticated users can read bank accounts" ON entity_bank_accounts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Super Admins can manage bank accounts" ON entity_bank_accounts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );

-- 6. CLIENT POLICIES
CREATE POLICY "Authenticated users can read clients" ON billing_clients
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authorized team members can insert/update clients" ON billing_clients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_name IN ('Super Admin', 'Finance Admin', 'Client Service')
        )
    );

-- 7. INVOICE POLICIES
CREATE POLICY "Authenticated users can read invoices" ON invoices
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authorized team members can manage invoice drafts" ON invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_name IN ('Super Admin', 'Finance Admin', 'Client Service', 'Project Manager')
        )
    );

-- 8. INVOICE ITEMS POLICIES
CREATE POLICY "Authenticated users can read invoice items" ON invoice_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authorized team members can manage invoice items" ON invoice_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_name IN ('Super Admin', 'Finance Admin', 'Client Service', 'Project Manager')
        )
    );

-- 9. INVOICE SNAPSHOT POLICIES
CREATE POLICY "Authenticated users can read snapshots" ON invoice_snapshots
    FOR SELECT USING (auth.role() = 'authenticated');

-- 10. PAYMENTS POLICIES
CREATE POLICY "Authenticated users can read payments" ON invoice_payments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Finance Admins and Super Admins can manage payments" ON invoice_payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_name IN ('Super Admin', 'Finance Admin')
        )
    );

-- 11. MONEY RECEIPTS POLICIES
CREATE POLICY "Authenticated users can read receipts" ON money_receipts
    FOR SELECT USING (auth.role() = 'authenticated');

-- 12. EMAIL LOGS POLICIES
CREATE POLICY "Authenticated users can read email logs" ON invoice_email_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authorized team members can create email logs" ON invoice_email_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 13. AUDIT LOGS POLICIES
CREATE POLICY "Super Admins can read audit logs" ON billing_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );

-- 14. SETTINGS POLICIES
CREATE POLICY "Authenticated users can read settings" ON billing_settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Super Admins can update settings" ON billing_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role_name = 'Super Admin'
        )
    );
