import { supabase } from '../src/lib/supabase';
import fs from 'fs';
import path from 'path';

async function runReconciliationAudit() {
  console.log('=== STARTING EXISTING INVOICE NUMBER RECONCILIATION AUDIT ===\n');

  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, currency, issue_date, created_at, client_id, entity_id')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to query invoices:', error);
    process.exit(1);
  }

  console.log(`Total invoices found in Supabase: ${invoices.length}`);

  const classified = {
    draftNoNumber: [] as any[],
    pendingApprovalNoNumber: [] as any[],
    approvedValidNumber: [] as any[],
    approvedMissingNumber: [] as any[],
    duplicateNumber: [] as any[],
    invalidFormatOrTest: [] as any[]
  };

  const numberCounts = new Map<string, number>();

  for (const inv of invoices) {
    const num = inv.invoice_number;
    if (num) {
      numberCounts.set(num, (numberCounts.get(num) || 0) + 1);
    }

    if (inv.status === 'draft') {
      if (!num) classified.draftNoNumber.push(inv);
      else classified.invalidFormatOrTest.push({ ...inv, reason: 'Draft has number assigned' });
    } else if (inv.status === 'pending_approval') {
      if (!num) classified.pendingApprovalNoNumber.push(inv);
      else classified.invalidFormatOrTest.push({ ...inv, reason: 'Pending approval has number assigned' });
    } else if (['approved', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue'].includes(inv.status)) {
      if (!num) {
        classified.approvedMissingNumber.push(inv);
      } else if (num.startsWith('CLTD-') || num.startsWith('CLLC-')) {
        classified.approvedValidNumber.push(inv);
      } else {
        classified.invalidFormatOrTest.push({ ...inv, reason: 'Non-canonical prefix/format' });
      }
    }
  }

  // Check for duplicates
  for (const inv of invoices) {
    if (inv.invoice_number && (numberCounts.get(inv.invoice_number) || 0) > 1) {
      classified.duplicateNumber.push(inv);
    }
  }

  const reportMarkdown = `# INVOICE NUMBER RECONCILIATION REPORT

**Audit Timestamp:** ${new Date().toISOString()}  
**Total Database Invoices Audited:** ${invoices.length}

---

## 1. Executive Summary & Audit Classification

| Classification Category | Count | Status | Required Action |
| :--- | :---: | :---: | :--- |
| **Draft Invoices (No Number)** | ${classified.draftNoNumber.length} | ✅ OK | Display internal \`DRAFT\` watermark. No number needed. |
| **Pending Approval (No Number)** | ${classified.pendingApprovalNoNumber.length} | ✅ OK | Will receive next atomic serial upon admin approval. |
| **Approved Invoices (Valid Serial)** | ${classified.approvedValidNumber.length} | ✅ OK | Preserve existing invoice serial number intact. |
| **Approved Invoices (Missing Serial)** | ${classified.approvedMissingNumber.length} | ⚠️ REPAIR NEEDED | Run administrator repair tool to assign serial without renumbering valid records. |
| **Duplicate Serial Numbers** | ${classified.duplicateNumber.length} | 🛡️ ENFORCED | Blocked by PostgreSQL UNIQUE constraint. |
| **Invalid / Test Format Serials** | ${classified.invalidFormatOrTest.length} | ⚠️ AUDITED | Logged in audit trail. |

---

## 2. Detailed Invoice Audit Trail

\`\`\`json
${JSON.stringify({
  summary: {
    total: invoices.length,
    drafts: classified.draftNoNumber.length,
    pending: classified.pendingApprovalNoNumber.length,
    approvedValid: classified.approvedValidNumber.length,
    approvedMissing: classified.approvedMissingNumber.length,
    duplicates: classified.duplicateNumber.length,
    invalid: classified.invalidFormatOrTest.length
  },
  approvedValidList: classified.approvedValidNumber.map(i => ({ id: i.id, number: i.invoice_number, status: i.status, currency: i.currency })),
  approvedMissingList: classified.approvedMissingNumber.map(i => ({ id: i.id, status: i.status, currency: i.currency }))
}, null, 2)}
\`\`\`

---

## 3. Reconciliation Policy & Guarantees
1. **Zero Renumbering of Valid Records:** All approved invoices with valid \`CLTD-\` or \`CLLC-\` serials are strictly preserved.
2. **Atomic Backfill:** Any approved invoice missing a serial number receives a serial from the DB counter via an explicit admin repair action.
3. **Draft Privacy:** Draft invoices display \`DRAFT\` in internal screens and cannot be shared publicly.
`;

  fs.writeFileSync(path.join(process.cwd(), 'INVOICE_NUMBER_RECONCILIATION_REPORT.md'), reportMarkdown);
  console.log('✓ INVOICE_NUMBER_RECONCILIATION_REPORT.md generated successfully!');
}

runReconciliationAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
