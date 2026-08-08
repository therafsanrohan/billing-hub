-- Migration for Company Reserve, Savings, FDR, and DPS Management Module

-- 1. RESERVE SETTINGS
CREATE TABLE IF NOT EXISTS reserve_settings (
    id TEXT PRIMARY KEY DEFAULT 'default-setting',
    reserve_percentage NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    target_type TEXT NOT NULL DEFAULT 'EXPENSE_MONTHS',
    target_value NUMERIC(15, 2) DEFAULT 6.00,
    target_fixed_bdt NUMERIC(15, 2) DEFAULT 5000000.00,
    target_fixed_usd NUMERIC(15, 2) DEFAULT 50000.00,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RESERVE SETTINGS HISTORY
CREATE TABLE IF NOT EXISTS reserve_settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    previous_percentage NUMERIC(5, 2) NOT NULL,
    new_percentage NUMERIC(5, 2) NOT NULL,
    changed_by TEXT NOT NULL,
    effective_date DATE NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RESERVE LEDGER
CREATE TABLE IF NOT EXISTS reserve_ledger (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL DEFAULT 'ent-1',
    currency TEXT NOT NULL DEFAULT 'BDT',
    transaction_type TEXT NOT NULL CHECK (
        transaction_type IN (
            'AUTOMATIC_RESERVE_ALLOCATION',
            'MANUAL_DEPOSIT',
            'RESERVE_ADJUSTMENT',
            'RESERVE_WITHDRAWAL',
            'TRANSFER_TO_FDR',
            'TRANSFER_TO_DPS',
            'TRANSFER_FROM_FDR',
            'TRANSFER_FROM_DPS',
            'INTEREST_RECEIVED',
            'BANK_CHARGE',
            'TAX_DEDUCTION',
            'PENALTY',
            'MATURITY_PROCEEDS',
            'RENEWAL',
            'REFUND_ADJUSTMENT',
            'CURRENCY_ADJUSTMENT',
            'OPENING_BALANCE'
        )
    ),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    source TEXT DEFAULT 'SYSTEM',
    payment_id TEXT,
    invoice_id TEXT,
    client_id TEXT,
    deposit_date DATE NOT NULL,
    withdrawal_date DATE,
    destination_account TEXT,
    reason TEXT,
    status TEXT DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING', 'CANCELLED', 'REVERSED')),
    created_by TEXT,
    verified_by TEXT,
    approved_by TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. FDR ACCOUNTS
CREATE TABLE IF NOT EXISTS fdr_accounts (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL DEFAULT 'ent-1',
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    account_title TEXT NOT NULL,
    fdr_reference_number TEXT NOT NULL,
    principal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'BDT',
    interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    rate_type TEXT DEFAULT 'SIMPLE',
    start_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    tenure_months INT NOT NULL DEFAULT 12,
    expected_gross_return NUMERIC(15, 2) DEFAULT 0.00,
    expected_tax_deduction NUMERIC(15, 2) DEFAULT 0.00,
    expected_bank_charges NUMERIC(15, 2) DEFAULT 0.00,
    expected_net_maturity_value NUMERIC(15, 2) DEFAULT 0.00,
    actual_maturity_value NUMERIC(15, 2),
    auto_renewal BOOLEAN DEFAULT false,
    renewal_instruction TEXT,
    nominee_name TEXT,
    lien_status BOOLEAN DEFAULT false,
    linked_bank_account TEXT,
    funding_source TEXT DEFAULT 'COMPANY_RESERVE',
    status TEXT DEFAULT 'ACTIVE' CHECK (
        status IN (
            'DRAFT',
            'PENDING_APPROVAL',
            'ACTIVE',
            'NEAR_MATURITY',
            'MATURED',
            'RENEWED',
            'PARTIALLY_ENCUMBERED',
            'CLOSED',
            'CANCELLED'
        )
    ),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. DPS ACCOUNTS
CREATE TABLE IF NOT EXISTS dps_accounts (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL DEFAULT 'ent-1',
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    account_title TEXT NOT NULL,
    dps_account_number TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BDT',
    installment_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payment_frequency TEXT DEFAULT 'MONTHLY',
    start_date DATE NOT NULL,
    next_installment_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    total_installments INT NOT NULL DEFAULT 12,
    paid_installments INT DEFAULT 0,
    remaining_installments INT DEFAULT 12,
    total_deposited_amount NUMERIC(15, 2) DEFAULT 0.00,
    expected_interest_amount NUMERIC(15, 2) DEFAULT 0.00,
    expected_maturity_value NUMERIC(15, 2) DEFAULT 0.00,
    actual_maturity_value NUMERIC(15, 2),
    late_payment_charge NUMERIC(15, 2) DEFAULT 0.00,
    missed_installments_count INT DEFAULT 0,
    grace_period_days INT DEFAULT 5,
    auto_debit BOOLEAN DEFAULT false,
    linked_bank_account TEXT,
    funding_source TEXT DEFAULT 'COMPANY_RESERVE',
    status TEXT DEFAULT 'ACTIVE' CHECK (
        status IN (
            'DRAFT',
            'PENDING_APPROVAL',
            'ACTIVE',
            'PAYMENT_DUE',
            'OVERDUE',
            'MATURED',
            'CLOSED',
            'CANCELLED'
        )
    ),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. DPS INSTALLMENTS
CREATE TABLE IF NOT EXISTS dps_installments (
    id TEXT PRIMARY KEY,
    dps_account_id TEXT NOT NULL REFERENCES dps_accounts(id) ON DELETE CASCADE,
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE', 'SKIPPED')),
    paid_date DATE,
    transaction_reference TEXT,
    paid_from_account TEXT,
    late_fee NUMERIC(15, 2) DEFAULT 0.00,
    notes TEXT,
    verified_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. RESERVE WITHDRAWAL REQUESTS
CREATE TABLE IF NOT EXISTS reserve_withdrawal_requests (
    id TEXT PRIMARY KEY,
    requested_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'BDT',
    entity_id TEXT NOT NULL DEFAULT 'ent-1',
    purpose TEXT NOT NULL,
    detailed_reason TEXT NOT NULL,
    emergency_category TEXT DEFAULT 'EMERGENCY_OPERATIONS',
    requested_by TEXT NOT NULL,
    request_date DATE NOT NULL,
    destination_account TEXT,
    status TEXT DEFAULT 'SUBMITTED' CHECK (
        status IN (
            'DRAFT',
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'REJECTED',
            'PAID',
            'CANCELLED'
        )
    ),
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_comment TEXT,
    override_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SAVINGS DOCUMENTS
CREATE TABLE IF NOT EXISTS savings_documents (
    id TEXT PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (
        document_type IN (
            'FDR_CERTIFICATE',
            'DPS_CERTIFICATE',
            'BANK_STATEMENT',
            'DEPOSIT_SLIP',
            'WITHDRAWAL_APPROVAL',
            'TAX_CERTIFICATE',
            'MATURITY_STATEMENT'
        )
    ),
    document_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    related_fdr_id TEXT,
    related_dps_id TEXT,
    related_withdrawal_id TEXT,
    entity_id TEXT DEFAULT 'ent-1',
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. FINANCIAL RECONCILIATIONS
CREATE TABLE IF NOT EXISTS financial_reconciliations (
    id TEXT PRIMARY KEY,
    account_type TEXT NOT NULL CHECK (account_type IN ('RESERVE_CASH', 'FDR', 'DPS')),
    target_id TEXT NOT NULL,
    statement_date DATE NOT NULL,
    system_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    statement_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discrepancy_amount NUMERIC(15, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'MATCHED' CHECK (status IN ('MATCHED', 'PARTIALLY_MATCHED', 'MISMATCHED', 'PENDING_REVIEW')),
    notes TEXT,
    reconciled_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. FINANCIAL AUDIT LOGS
CREATE TABLE IF NOT EXISTS financial_audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT 'RESERVE_SAVINGS',
    record_id TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initial default settings row
INSERT INTO reserve_settings (id, reserve_percentage, target_type, target_value, target_fixed_bdt, target_fixed_usd)
VALUES ('default-setting', 20.00, 'EXPENSE_MONTHS', 6.00, 5000000.00, 50000.00)
ON CONFLICT (id) DO NOTHING;
