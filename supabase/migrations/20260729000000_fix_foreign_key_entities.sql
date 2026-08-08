-- Migration to resolve entity foreign key constraints and missing entities
-- Date: 2026-07-29

-- 1. Ensure canonical Business Entities exist for both UUID formats
INSERT INTO public.business_entities (
    id, legal_name, entity_code, registered_address, registration_number, tax_id, email, phone, website, invoice_prefix, receipt_prefix, vat_footer, corporate_tax_rate, default_vat_rate
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
    'All rates are inclusive of applicable VAT in accordance with prevailing laws.',
    30.00,
    15.00
),
(
    '11111111-1111-4111-8111-111111111111',
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
    'All rates are inclusive of applicable VAT in accordance with prevailing laws.',
    30.00,
    15.00
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
    'All rates are inclusive of applicable taxes.',
    21.00,
    0.00
),
(
    '22222222-2222-4222-8222-222222222222',
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
    'All rates are inclusive of applicable taxes.',
    21.00,
    0.00
)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure default profile exists for foreign key references
INSERT INTO public.profiles (
    id, full_name, email, role_name, is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System Admin Owner',
    'admin@corevow.com',
    'super_admin',
    true
)
ON CONFLICT (id) DO NOTHING;
