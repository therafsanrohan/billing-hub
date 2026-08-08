import { InvoiceDocumentViewModel } from './invoice-document.types';
import { QRCodeSVG } from 'qrcode.react';
import { Building2, ShieldCheck } from 'lucide-react';

interface Props {
  document: InvoiceDocumentViewModel;
  showWatermark?: boolean;
}

export default function InvoiceDocument({ document: doc }: Props) {
  const isBdt = doc.currency === 'BDT';

  const formatMoney = (amount: number) => {
    if (isBdt) {
      return `৳${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div id="print-area" className="relative mx-auto bg-[#f5f4eb] text-[#1E1E1E] max-w-[210mm] w-full box-border p-8 sm:p-10 shadow-md print:shadow-none print:p-4 rounded-xl border border-gray-200 print:border-none print:rounded-none">
      
      {/* Draft Internal Watermark Overlay */}
      {doc.isDraft && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-35 text-6xl sm:text-8xl font-black text-rose-500/10 uppercase tracking-widest pointer-events-none select-none z-0 border-8 border-rose-500/10 px-8 py-4 rounded-3xl">
          DRAFT
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-[#100e09] pb-6 mb-6 gap-6 relative z-10">
        <div>
          <div className="flex items-center space-x-2">
            <Building2 className="h-7 w-7 text-[#100e09]" />
            <span className="text-2xl font-extrabold tracking-tight text-gray-900">{doc.entity.name}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-sm whitespace-pre-line leading-relaxed">{doc.entity.address}</p>
          <div className="text-[11px] text-gray-500 mt-1.5 space-y-0.5">
            {doc.entity.taxId && <p><span className="font-semibold text-gray-700">Tax/BIN ID:</span> {doc.entity.taxId}</p>}
            {doc.entity.email && <p><span className="font-semibold text-gray-700">Email:</span> {doc.entity.email}</p>}
          </div>
        </div>

        <div className="sm:text-right">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">INVOICE</h1>
          <p className="text-base sm:text-lg font-bold text-[#100e09] mt-1">
            {doc.isDraft ? 'DRAFT' : doc.invoiceNumber}
          </p>
          <div className="text-xs text-gray-500 mt-2 space-y-0.5">
            <p><span className="font-semibold text-gray-700">Issue Date:</span> {doc.issueDate}</p>
            <p><span className="font-semibold text-gray-700">Due Date:</span> {doc.dueDate}</p>
            {doc.poNumber && <p><span className="font-semibold text-gray-700">PO #:</span> {doc.poNumber}</p>}
          </div>
        </div>
      </div>

      {/* Details Grid: Billed To & Project Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 relative z-10">
        <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 text-xs space-y-1">
          <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Billed To</span>
          <p className="text-sm font-bold text-gray-900">{doc.client.companyName}</p>
          <p className="text-gray-700 font-medium">Attn: {doc.client.contactPerson}</p>
          <p className="text-gray-600 whitespace-pre-line leading-relaxed mt-1">{doc.client.billingAddress}</p>
          <p className="text-gray-600">{doc.client.city}, {doc.client.country}</p>
          {doc.client.taxNumber && (
            <p className="text-gray-700 font-semibold mt-1">Tax / BIN ID: {doc.client.taxNumber}</p>
          )}
        </div>

        <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 text-xs space-y-1">
          <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Project & Reference</span>
          <p className="text-sm font-bold text-gray-900">{doc.projectName}</p>
          {doc.servicePeriod && <p className="text-gray-600"><span className="font-semibold text-gray-700">Service Period:</span> {doc.servicePeriod}</p>}
          {doc.referenceNumber && <p className="text-gray-600"><span className="font-semibold text-gray-700">Reference:</span> {doc.referenceNumber}</p>}
          <p className="text-gray-600"><span className="font-semibold text-gray-700">Billing Currency:</span> {doc.currency}</p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto mb-6 relative z-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-600 uppercase">
              <th className="py-2.5 px-3">Item & Description</th>
              <th className="py-2.5 px-3 text-right">Qty</th>
              <th className="py-2.5 px-3 text-right">Unit Price ({doc.currency})</th>
              <th className="py-2.5 px-3 text-right">Amount ({doc.currency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-xs">
            {doc.items.map((item, idx) => (
              <tr key={idx} className="avoid-break">
                <td className="py-3 px-3">
                  <p className="font-bold text-gray-900">{item.serviceName}</p>
                  {item.description && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>}
                </td>
                <td className="py-3 px-3 text-right text-gray-700 whitespace-nowrap">{item.quantity} {item.unit}</td>
                <td className="py-3 px-3 text-right text-gray-700 whitespace-nowrap">{formatMoney(item.rate)}</td>
                <td className="py-3 px-3 text-right font-bold text-gray-900 whitespace-nowrap">{formatMoney(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Summary Table */}
      <div className="flex justify-end mb-6 relative z-10 avoid-break">
        <div className="w-full sm:w-72 bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 space-y-2 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-gray-900">{formatMoney(doc.totals.subtotal)}</span>
          </div>

          {doc.totals.discountAmount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount:</span>
              <span className="font-semibold">-{formatMoney(doc.totals.discountAmount)}</span>
            </div>
          )}

          {doc.totals.vatAmount > 0 ? (
            <div className="flex justify-between text-gray-600">
              <span>VAT / Tax ({doc.totals.vatRate}%):</span>
              <span className="font-semibold">+{formatMoney(doc.totals.vatAmount)}</span>
            </div>
          ) : isBdt ? (
            <div className="flex justify-between text-gray-500 text-[11px]">
              <span>VAT Status:</span>
              <span className="font-semibold text-emerald-700">Not Applied (0% Exempt)</span>
            </div>
          ) : null}

          <div className="flex justify-between border-t border-gray-300 pt-2 text-sm font-black text-[#100e09]">
            <span>Total Payable:</span>
            <span>{formatMoney(doc.totals.totalPayable)}</span>
          </div>

          {doc.totals.amountPaid > 0 && (
            <>
              <div className="flex justify-between text-green-700 font-semibold pt-1">
                <span>Amount Paid:</span>
                <span>-{formatMoney(doc.totals.amountPaid)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 text-xs font-bold text-rose-700">
                <span>Balance Due:</span>
                <span>{formatMoney(doc.totals.amountDue)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Remittance Bank Details & QR Verification Section */}
      <div className="border-t border-gray-200 pt-4 space-y-4 relative z-10 avoid-break">
        <span className="font-extrabold text-[10px] uppercase tracking-wider text-gray-400 block">
          PAYMENT & REMITTANCE INSTRUCTIONS
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Bank Account Box */}
          {doc.bankAccount ? (
            <div className="rounded-xl bg-gray-50/80 p-3.5 border border-gray-200/80 space-y-1 text-gray-700">
              <div className="flex items-center space-x-1.5 text-[#100e09] font-bold text-xs mb-1">
                <Building2 className="h-4 w-4" />
                <span>{doc.bankAccount.bankName}</span>
              </div>
              <p className="text-[11px]"><span className="font-semibold text-gray-500">Account Holder:</span> <strong className="text-gray-900">{doc.bankAccount.accountHolder}</strong></p>
              <p className="text-[11px]"><span className="font-semibold text-gray-500">Account Number:</span> <strong className="font-mono text-gray-900">{doc.bankAccount.accountNumber}</strong></p>
              {doc.bankAccount.branch && <p className="text-[11px]"><span className="font-semibold text-gray-500">Branch Name:</span> <span className="text-gray-800">{doc.bankAccount.branch}</span></p>}
              {doc.bankAccount.routingNumber && <p className="text-[11px]"><span className="font-semibold text-gray-500">Routing Code:</span> <span className="font-mono text-gray-800">{doc.bankAccount.routingNumber}</span></p>}
              {doc.bankAccount.swiftBic && <p className="text-[11px]"><span className="font-semibold text-gray-500">SWIFT / BIC:</span> <span className="font-mono text-gray-800">{doc.bankAccount.swiftBic}</span></p>}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50/80 p-3.5 border border-gray-200/80 text-xs text-gray-500 italic">
              Please contact your account manager for payment instructions.
            </div>
          )}

          {/* Mobile Wallets & Instructions */}
          <div className="space-y-2">
            {isBdt && (doc.entity.bkashMerchant || doc.entity.nagadMerchant) && (
              <div className="rounded-xl border border-gray-200/80 bg-gray-50/80 p-3 space-y-1.5">
                <p className="font-bold text-[10px] text-gray-500 uppercase tracking-wider">Mobile Wallet (Merchant Payment)</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {doc.entity.bkashMerchant && (
                    <div className="rounded-lg bg-[#f5f4eb] p-2 border border-gray-200">
                      <span className="text-[9px] font-bold text-pink-600 block uppercase">bKash Merchant</span>
                      <span className="font-mono font-extrabold text-gray-900 text-xs">{doc.entity.bkashMerchant}</span>
                    </div>
                  )}
                  {doc.entity.nagadMerchant && (
                    <div className="rounded-lg bg-[#f5f4eb] p-2 border border-gray-200">
                      <span className="text-[9px] font-bold text-orange-600 block uppercase">Nagad Merchant</span>
                      <span className="font-mono font-extrabold text-gray-900 text-xs">{doc.entity.nagadMerchant}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {doc.paymentInstructions && (
              <div className="rounded-xl bg-gray-50/80 p-3 border border-gray-200/80 text-[11px] text-gray-700 leading-relaxed italic">
                {doc.paymentInstructions}
              </div>
            )}
          </div>
        </div>

        {/* QR Authenticity Badge */}
        {doc.verificationUrl && !doc.isDraft && (
          <div className="flex items-center justify-between rounded-xl border border-[#100e09]/20 bg-[#100e09]/5 p-3 avoid-break">
            <div className="flex items-center space-x-3">
              <QRCodeSVG
                value={doc.verificationUrl}
                size={52}
                bgColor="#f5f4eb"
                fgColor="#100e09"
                level="M"
                marginSize={1}
              />
              <div>
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#100e09]" />
                  <span className="font-extrabold text-[#100e09] text-xs uppercase tracking-wider">app Authenticity Verified</span>
                </div>
                <p className="text-gray-600 text-[10px] leading-tight mt-0.5">
                  Scan QR code to verify digital signature on official portal.
                </p>
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <span className="text-[9px] font-extrabold uppercase text-[#100e09] bg-[#f5f4eb] border border-[#100e09]/20 px-2.5 py-1 rounded-md shadow-2xs">
                app
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legal Footer */}
      <div className="mt-6 pt-3 border-t border-gray-200 text-[10px] text-gray-500 text-center leading-normal space-y-0.5 avoid-break relative z-10">
        <p className="font-bold text-[#100e09] tracking-wide">
          {doc.entity.name}
        </p>
        <p className="text-gray-500 text-[9px]">
          {isBdt
            ? 'All rates are inclusive of applicable VAT in accordance with the prevailing laws and regulations of Bangladesh.'
            : 'All rates are inclusive of applicable taxes in accordance with the prevailing laws and regulations.'}
        </p>
        <div className="pt-1.5 border-t border-dashed border-gray-200 text-[9px] font-semibold text-gray-400">
          app Document • Computer-generated • No physical signature required.
        </div>
      </div>

    </div>
  );
}
