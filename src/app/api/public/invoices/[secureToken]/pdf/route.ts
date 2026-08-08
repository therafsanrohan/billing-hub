import { NextRequest, NextResponse } from 'next/server';
import { getSanitizedPublicInvoice } from '@/lib/services/public-invoice-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ secureToken: string }> }
) {
  try {
    const { secureToken } = await params;
    let result = await getSanitizedPublicInvoice(secureToken);

    if (!result.success && result.redirectTo) {
      result = await getSanitizedPublicInvoice(result.redirectTo);
    }

    if (!result.success || !result.invoice) {
      return new NextResponse('Invoice link is unavailable or invalid.', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
          'Cache-Control': 'private, no-store'
        }
      });
    }

    const inv = result.invoice;
    const filename = `Invoice_${inv.invoiceNumber.replace(/[\/\\?%*:|"<>]/g, '-')}.pdf`;

    // Construct printable HTML document with auto-print trigger for PDF saving
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="robots" content="noindex, nofollow, noarchive">
    <title>Invoice ${inv.invoiceNumber}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1f2937; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #100e09; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: 800; color: #100e09; letter-spacing: -0.5px; }
        .inv-title { text-align: right; }
        .inv-title h1 { margin: 0; font-size: 28px; color: #111827; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
        .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
        .box-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f3f4f6; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb; }
        td { padding: 12px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
        .text-right { text-align: right; }
        .totals-table { width: 300px; margin-left: auto; margin-bottom: 30px; }
        .totals-table td { padding: 6px 12px; }
        .grand-total { font-size: 16px; font-weight: 800; color: #100e09; border-top: 2px solid #100e09; }
        .footer { font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo">${inv.entity.name}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${inv.entity.address}</div>
        </div>
        <div class="inv-title">
            <h1>INVOICE</h1>
            <div style="font-size: 14px; font-weight: 700; color: #374151; margin-top: 4px;">${inv.invoiceNumber}</div>
            <div style="font-size: 12px; color: #6b7280;">Issue Date: ${inv.issueDate} | Due Date: ${inv.dueDate}</div>
        </div>
    </div>

    <div class="details-grid">
        <div class="box">
            <div class="box-title">Billed To</div>
            <div style="font-weight: 700; font-size: 15px;">${inv.client.companyName}</div>
            <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">Attn: ${inv.client.contactPerson}</div>
            <div style="font-size: 13px; color: #4b5563;">${inv.client.billingAddress}, ${inv.client.city}, ${inv.client.country}</div>
            ${inv.client.taxNumber ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Tax ID: ${inv.client.taxNumber}</div>` : ''}
        </div>
        <div class="box">
            <div class="box-title">Project & Reference</div>
            <div style="font-weight: 700; font-size: 14px;">${inv.projectName}</div>
            ${inv.servicePeriod ? `<div style="font-size: 12px; color: #6b7280;">Period: ${inv.servicePeriod}</div>` : ''}
            ${inv.poNumber ? `<div style="font-size: 12px; color: #6b7280;">PO #: ${inv.poNumber}</div>` : ''}
            ${inv.bankAccount ? `
                <div class="box-title" style="margin-top: 12px;">Remittance Bank</div>
                <div style="font-size: 12px; font-weight: 600;">${inv.bankAccount.bankName} (${inv.bankAccount.branch})</div>
                <div style="font-size: 12px; color: #4b5563;">A/C: ${inv.bankAccount.accountNumber}</div>
            ` : ''}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Item Description</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate (${inv.currency})</th>
                <th class="text-right">Amount (${inv.currency})</th>
            </tr>
        </thead>
        <tbody>
            ${inv.items.map(item => `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${item.serviceName}</div>
                        ${item.description ? `<div style="font-size: 12px; color: #6b7280;">${item.description}</div>` : ''}
                    </td>
                    <td class="text-right">${item.quantity} ${item.unit}</td>
                    <td class="text-right">${item.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td class="text-right" style="font-weight: 600;">${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <table class="totals-table">
        <tr>
            <td>Subtotal:</td>
            <td class="text-right">${inv.totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${inv.currency}</td>
        </tr>
        ${inv.totals.discountAmount > 0 ? `
            <tr>
                <td>Discount:</td>
                <td class="text-right">-${inv.totals.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${inv.currency}</td>
            </tr>
        ` : ''}
        ${inv.totals.vatAmount > 0 ? `
            <tr>
                <td>VAT / Tax:</td>
                <td class="text-right">+${inv.totals.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${inv.currency}</td>
            </tr>
        ` : ''}
        <tr class="grand-total">
            <td>Total Payable:</td>
            <td class="text-right">${inv.totals.totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${inv.currency}</td>
        </tr>
        ${inv.totals.amountPaid > 0 ? `
            <tr>
                <td>Amount Paid:</td>
                <td class="text-right" style="color: #059669; font-weight: 600;">-${inv.totals.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${inv.currency}</td>
            </tr>
            <tr style="font-weight: 800; border-top: 1px solid #e5e7eb;">
                <td>Balance Due:</td>
                <td class="text-right" style="color: #dc2626;">${inv.totals.amountDue.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${inv.currency}</td>
            </tr>
        ` : ''}
    </table>

    <div class="footer">
        <div>Verified Official Invoice • ${inv.entity.name}</div>
        <div>Document Reference Token: ${inv.canonicalToken}</div>
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (err: any) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
