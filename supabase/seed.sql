-- Fictional Seed Data for Corevow Billing Hub V1

-- 1. Insert Default Profiles (Fictional UUIDs for development / local testing)
INSERT INTO profiles (id, full_name, email, role_name) VALUES
('00000000-0000-0000-0000-000000000001', 'Rafsan Rohan (Super Admin)', 'admin@corevow.com', 'Super Admin'),
('00000000-0000-0000-0000-000000000002', 'Finance Executive (Finance Admin)', 'finance@corevow.com', 'Finance Admin'),
('00000000-0000-0000-0000-000000000003', 'Client Manager (Client Service)', 'cs@corevow.com', 'Client Service'),
('00000000-0000-0000-0000-000000000004', 'Project Coordinator (Project Manager)', 'pm@corevow.com', 'Project Manager')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Business Entities (Fictional registration numbers and contact details)
INSERT INTO business_entities (
    id, legal_name, entity_code, registered_address, registration_number, tax_id, email, phone, website, invoice_prefix, receipt_prefix, vat_footer, bkash_merchant, nagad_merchant
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Corevow Limited',
    'CLTD',
    'House 12, Road 4, Banani, Dhaka 1213, Bangladesh',
    'C-CLTD-DHAKA-2026',
    'TIN-BIN-CLTD-123456',
    'billing@corevow.com',
    '+880 1325 078 941',
    'www.corevow.com',
    'CLTD-BDT',
    'CLTD-REC',
    'All rates are inclusive of applicable VAT in accordance with the prevailing laws and regulations.',
    '01711223344',
    '01888776655'
),
(
    '22222222-2222-2222-2222-222222222222',
    'Corevow LLC',
    'CLLC',
    '1619 Broadway, Suite 500, New York, NY 10019, USA',
    'NY-CLLC-2026-98765',
    'EIN-12-3456789',
    'billing@corevow.com',
    '+1 212 555 0199',
    'www.corevow.com',
    'CLLC-USD',
    'CLLC-REC',
    'All rates are inclusive of applicable taxes in accordance with the prevailing laws and regulations.',
    NULL,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Bank Accounts
INSERT INTO entity_bank_accounts (
    id, entity_id, bank_name, account_holder, account_number, branch, routing_number, swift_bic, bank_address, is_active
) VALUES
(
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Fictional Trust Bank Bangladesh',
    'Corevow Limited',
    'BDT-ACC-1002003004005',
    'Banani Branch',
    '123456789',
    'TRSTBDDH',
    'Banani, Dhaka, Bangladesh',
    true
),
(
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'Fictional Apex Bank USA',
    'Corevow LLC',
    'USD-ACC-9876543210',
    'Wall Street Branch',
    '987654321',
    'APEXUS33XXX',
    'Wall Street, New York, NY, USA',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed initial sequence counts
INSERT INTO invoice_sequences (entity_code, year, last_sequence) VALUES
('CLTD', 2026, 0),
('CLLC', 2026, 0)
ON CONFLICT (entity_code, year) DO NOTHING;

-- 5. Seed default global settings
INSERT INTO billing_settings (key, value) VALUES
('vat_config', json_build_object('default_rate', 15.00, 'inclusive', true, 'footer', 'All rates are inclusive of applicable VAT in accordance with the prevailing laws and regulations.')::JSONB)
ON CONFLICT (key) DO NOTHING;
