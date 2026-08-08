/**
 * Single Source of Truth View Model for Canonical Invoice Document
 * Used identically across Internal Preview, Public Client View, A4 Print, and PDF Streaming.
 */

export interface InvoiceDocumentViewModel {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  isDraft: boolean;
  issueDate: string;
  dueDate: string;
  paymentTerms?: string;
  currency: 'BDT' | 'USD';
  projectName: string;
  servicePeriod?: string;
  poNumber?: string;
  referenceNumber?: string;
  items: Array<{
    serviceName: string;
    description?: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
  }>;
  totals: {
    subtotal: number;
    discountType?: 'none' | 'percentage' | 'fixed';
    discountValue?: number;
    discountAmount: number;
    vatRate?: number;
    vatInclusive?: boolean;
    vatAmount: number;
    totalPayable: number;
    amountPaid: number;
    amountDue: number;
  };
  client: {
    companyName: string;
    contactPerson: string;
    billingAddress: string;
    city: string;
    country: string;
    billingEmail?: string;
    taxNumber?: string;
  };
  entity: {
    name: string;
    code: string;
    address: string;
    email?: string;
    phone?: string;
    website?: string;
    taxId?: string;
    bkashMerchant?: string;
    nagadMerchant?: string;
  };
  bankAccount?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    branch?: string;
    routingNumber?: string;
    swiftBic?: string;
  };
  paymentInstructions?: string;
  termsConditions?: string;
  verificationUrl?: string;
  canonicalToken?: string;
}
