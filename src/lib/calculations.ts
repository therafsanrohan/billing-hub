/**
 * Safe billing calculations to prevent JS floating-point precision issues.
 * All math is conducted by converting numbers to integer cents/paisa (multiplying by 100),
 * performing integer arithmetic, and converting back.
 */

export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export interface LineItem {
  quantity: number;
  rate: number;
  is_paid_media?: boolean;
  service_name?: string;
  service_category_code?: string;
  service_code?: string;
  vat_pricing_mode?: VatPricingMode;
  vat_rate?: number;
  vds_rate?: number;
}

export type VatPricingMode = 'VAT_EXCLUSIVE' | 'VAT_INCLUSIVE' | 'ZERO_RATED' | 'EXEMPT' | 'OUT_OF_SCOPE';

export interface CalculateLineVatInput {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  vatPricingMode: VatPricingMode;
  vatRate: number;
  vdsRate?: number;
}

export interface LineVatResult {
  taxableValue: number;
  vatAmount: number;
  lineTotal: number;
  expectedVds: number;
  appliedVatRate: number;
}

export function calculateLineVat(input: CalculateLineVatInput): LineVatResult {
  const qty = Math.max(0, input.quantity);
  const unitPrice = Math.max(0, input.unitPrice);
  const discount = Math.max(0, input.discountAmount || 0);

  const vatRate = input.vatRate > 1 ? input.vatRate / 100 : Math.max(0, input.vatRate);
  const vdsRate = (input.vdsRate || 0) > 1 ? (input.vdsRate || 0) / 100 : Math.max(0, input.vdsRate || 0);

  const initialAmountCents = Math.max(0, Math.round(qty * unitPrice * 100) - toCents(discount));

  let taxableValueCents = initialAmountCents;
  let vatCents = 0;
  let lineTotalCents = initialAmountCents;

  if (input.vatPricingMode === 'VAT_EXCLUSIVE') {
    taxableValueCents = initialAmountCents;
    vatCents = Math.round(taxableValueCents * vatRate);
    lineTotalCents = taxableValueCents + vatCents;
  } else if (input.vatPricingMode === 'VAT_INCLUSIVE') {
    if (vatRate > 0) {
      taxableValueCents = Math.round(initialAmountCents / (1 + vatRate));
      vatCents = initialAmountCents - taxableValueCents;
    } else {
      taxableValueCents = initialAmountCents;
      vatCents = 0;
    }
    lineTotalCents = initialAmountCents;
  } else {
    taxableValueCents = initialAmountCents;
    vatCents = 0;
    lineTotalCents = initialAmountCents;
  }

  const expectedVdsCents = Math.round(taxableValueCents * vdsRate);

  return {
    taxableValue: fromCents(taxableValueCents),
    vatAmount: fromCents(vatCents),
    lineTotal: fromCents(lineTotalCents),
    expectedVds: fromCents(expectedVdsCents),
    appliedVatRate: vatRate
  };
}

export interface CalculateTotalsInput {
  items: LineItem[];
  discountType: 'none' | 'fixed' | 'percentage';
  discountValue: number;
  vatRate: number;
  vatInclusive: boolean;
  roundTotal?: boolean;
  expectedTdsAmount?: number;
  expectedVdsAmount?: number;
  payments?: { amount: number }[];
}

export interface BillingTotals {
  subtotal: number;
  discountableSubtotal: number;
  mediaBuyingSubtotal: number;
  discountAmount: number;
  vatAmount: number;
  totalPayable: number;
  expectedTds: number;
  expectedVds: number;
  netCashReceivable: number;
  amountPaid: number;
  amountDue: number;
}

/**
 * Fetch live market BDT/USD exchange rate with fallback
 */
export async function fetchLiveMarketUsdRate(): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates.BDT === 'number') {
        return parseFloat(data.rates.BDT.toFixed(2));
      }
    }
  } catch (e) {
    console.warn('Live USD rate fetch failed, defaulting to 125.50 BDT:', e);
  }
  return 125.50;
}

export function calculateTotals(input: CalculateTotalsInput): BillingTotals {
  const {
    items,
    discountType,
    discountValue,
    roundTotal = false,
    payments = []
  } = input;

  // 1. Separate discountable subtotal (services) vs non-discountable subtotal (media buying)
  let discountableSubtotalCents = 0;
  let mediaBuyingSubtotalCents = 0;
  let subtotalCents = 0;

  for (const item of items) {
    const qty = Math.max(0, item.quantity);
    const rate = Math.max(0, item.rate);
    const lineTotalCents = Math.round(qty * rate * 100);
    subtotalCents += lineTotalCents;

    const isMediaBuying = item.is_paid_media === true ||
      (item.service_name && (item.service_name.includes('Media Buying') || item.service_name.includes('Media Spend') || item.service_name.includes('Ad Budget')));

    if (isMediaBuying) {
      mediaBuyingSubtotalCents += lineTotalCents;
    } else {
      discountableSubtotalCents += lineTotalCents;
    }
  }

  // 2. Calculate discount safely ONLY on discountable subtotal (Media Buying excluded from discounts)
  let discountCents = 0;
  if (discountType === 'fixed') {
    discountCents = Math.min(discountableSubtotalCents, toCents(Math.max(0, discountValue)));
  } else if (discountType === 'percentage') {
    const percentage = Math.min(100, Math.max(0, discountValue));
    discountCents = Math.round((discountableSubtotalCents * percentage) / 100);
  }

  // 3. Calculate discounted total subtotal in cents
  const discountedSubtotalCents = Math.max(0, subtotalCents - discountCents);

  // 4. Calculate VAT amount & Total Payable (Exclusive VAT default)
  let vatCents = 0;
  let totalPayableCents = discountedSubtotalCents;

  if (input.vatRate > 0) {
    if (input.vatInclusive) {
      // VAT included in rates
      const vatRateDecimal = input.vatRate / 100;
      const preTaxCents = discountedSubtotalCents / (1 + vatRateDecimal);
      vatCents = Math.round(discountedSubtotalCents - preTaxCents);
      totalPayableCents = discountedSubtotalCents;
    } else {
      // VAT excluded (added on top) - Default standard
      vatCents = Math.round((discountedSubtotalCents * input.vatRate) / 100);
      totalPayableCents = discountedSubtotalCents + vatCents;
    }
  }

  // 5. Optional Fraction Rounding (Remove Decimals / Round Total)
  if (roundTotal) {
    totalPayableCents = Math.round(totalPayableCents / 100) * 100;
  }

  // 6. Calculate payments safely in cents
  let paymentsCents = 0;
  for (const p of payments) {
    paymentsCents += toCents(Math.max(0, p.amount));
  }

  // 7. Calculate amount due safely in cents
  const amountDueCents = Math.max(0, totalPayableCents - paymentsCents);

  const expectedTdsCents = toCents(Math.max(0, input.expectedTdsAmount || 0));
  const expectedVdsCents = toCents(Math.max(0, input.expectedVdsAmount || 0));
  const netCashReceivableCents = Math.max(0, totalPayableCents - expectedTdsCents - expectedVdsCents);

  return {
    subtotal: fromCents(subtotalCents),
    discountableSubtotal: fromCents(discountableSubtotalCents),
    mediaBuyingSubtotal: fromCents(mediaBuyingSubtotalCents),
    discountAmount: fromCents(discountCents),
    vatAmount: fromCents(vatCents),
    totalPayable: fromCents(totalPayableCents),
    expectedTds: fromCents(expectedTdsCents),
    expectedVds: fromCents(expectedVdsCents),
    netCashReceivable: fromCents(netCashReceivableCents),
    amountPaid: fromCents(paymentsCents),
    amountDue: fromCents(amountDueCents)
  };
}

/**
 * Format currency helper
 */
export function formatCurrency(amount: number, currency: 'BDT' | 'USD'): string {
  if (currency === 'BDT') {
    // Standard BDT format (e.g. ৳ 1,20,000 or using Bangladesh numbering layout)
    return `৳${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  } else {
    // USD format: $1,200.00
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
}

export interface BdCorporateTaxInput {
  grossReceipts: number;
  allowableExpenses: number;
  disallowedExpenses: number;
  otherAdjustments: number;
  allTransactionsViaBank: boolean;
  bankCompliantTaxRate: number; // e.g. 0.25 for 25%
  standardTaxRate: number;      // e.g. 0.275 for 27.5%
  turnoverThreshold: number;   // e.g. 5,000,000 BDT
  turnoverMinimumTaxRate: number; // e.g. 0.006 for 0.60%
  invoiceTdsSum?: number;      // Sum of source minimum tax from applicable invoices
  certifiedTds: number;
  advanceTaxPaid: number;
  manualTaxAdjustment: number;
  manualOverrideTax?: number | null;
}

export interface BdCorporateTaxResult {
  accountingProfit: number;
  taxableProfit: number;
  taxableProfitForTax: number;
  appliedCorporateTaxRate: number;
  regularCorporateTax: number;
  sourceMinimumTax: number;
  turnoverMinimumTax: number;
  grossTaxLiability: number;
  liabilityDeterminedBy: 'REGULAR_CORPORATE_TAX' | 'SOURCE_MINIMUM_TAX' | 'TURNOVER_MINIMUM_TAX';
  availableTaxCredit: number;
  systemCalculatedTax: number;
  manualOverrideTax: number | null;
  finalTaxPayable: number;
  unadjustedTaxCredit: number;
}

export function calculateBangladeshCorporateTax(input: BdCorporateTaxInput): BdCorporateTaxResult {
  const gross = Math.max(0, input.grossReceipts);
  const allowable = Math.max(0, input.allowableExpenses);
  const disallowed = Math.max(0, input.disallowedExpenses);
  const adjustments = input.otherAdjustments || 0;

  // 1. Accounting & Taxable profit
  const accountingProfit = roundToTwo(gross - allowable);
  const taxableProfit = roundToTwo(accountingProfit + disallowed + adjustments);
  const taxableProfitForTax = Math.max(0, taxableProfit);

  // 2. Applied corporate tax rate (25% bank compliant vs 27.5% standard)
  const appliedCorporateTaxRate = input.allTransactionsViaBank
    ? input.bankCompliantTaxRate
    : input.standardTaxRate;

  // 3. Regular Corporate Tax
  const regularCorporateTax = roundToTwo(taxableProfitForTax * appliedCorporateTaxRate);

  // 4. Source Minimum Tax
  const sourceMinimumTax = roundToTwo(Math.max(0, input.invoiceTdsSum || 0));

  // 5. Turnover Minimum Tax (Sec. 163, threshold check)
  const turnoverThreshold = input.turnoverThreshold || 5000000;
  const turnoverRate = input.turnoverMinimumTaxRate || 0.006;
  const turnoverMinimumTax = gross >= turnoverThreshold
    ? roundToTwo(gross * turnoverRate)
    : 0;

  // 6. Gross Tax Liability = MAX(regular, source_min, turnover_min)
  const grossTaxLiability = Math.max(regularCorporateTax, sourceMinimumTax, turnoverMinimumTax);

  let liabilityDeterminedBy: 'REGULAR_CORPORATE_TAX' | 'SOURCE_MINIMUM_TAX' | 'TURNOVER_MINIMUM_TAX' = 'REGULAR_CORPORATE_TAX';
  if (grossTaxLiability === turnoverMinimumTax && turnoverMinimumTax > regularCorporateTax && turnoverMinimumTax > sourceMinimumTax) {
    liabilityDeterminedBy = 'TURNOVER_MINIMUM_TAX';
  } else if (grossTaxLiability === sourceMinimumTax && sourceMinimumTax > regularCorporateTax) {
    liabilityDeterminedBy = 'SOURCE_MINIMUM_TAX';
  }

  // 7. Available Tax Credit = Verified Certified TDS + Advance Tax Paid
  const certifiedTds = Math.max(0, input.certifiedTds);
  const advanceTax = Math.max(0, input.advanceTaxPaid);
  const availableTaxCredit = roundToTwo(certifiedTds + advanceTax);

  // 8. System Calculated Tax
  const manualAdjustment = input.manualTaxAdjustment || 0;
  const systemCalculatedTax = Math.max(0, roundToTwo(grossTaxLiability - availableTaxCredit + manualAdjustment));

  // 9. Manual Override & Final Tax Payable
  const overrideVal = (input.manualOverrideTax !== undefined && input.manualOverrideTax !== null && !isNaN(input.manualOverrideTax))
    ? Math.max(0, input.manualOverrideTax)
    : null;
  const finalTaxPayable = overrideVal !== null ? overrideVal : systemCalculatedTax;

  // 10. Unadjusted Tax Credit (if credits exceed gross liability)
  const unadjustedTaxCredit = Math.max(0, roundToTwo(availableTaxCredit - grossTaxLiability));

  return {
    accountingProfit,
    taxableProfit,
    taxableProfitForTax,
    appliedCorporateTaxRate,
    regularCorporateTax,
    sourceMinimumTax,
    turnoverMinimumTax,
    grossTaxLiability,
    liabilityDeterminedBy,
    availableTaxCredit,
    systemCalculatedTax,
    manualOverrideTax: overrideVal,
    finalTaxPayable,
    unadjustedTaxCredit
  };
}

export interface CalculateGatewayFeeInput {
  grossPaymentAmount: number;
  percentageFeeRate: number;
  fixedFeeAmount?: number;
  taxOnFeeAmount?: number;
  currencyConversionFee?: number;
  bankCharge?: number;
}

export interface GatewayFeeResult {
  grossPaymentAmount: number;
  percentageFeeAmount: number;
  fixedFeeAmount: number;
  taxOnFeeAmount: number;
  currencyConversionFee: number;
  bankCharge: number;
  totalGatewayDeduction: number;
  netSettlementAmount: number;
}

export function calculateGatewayDeduction(input: CalculateGatewayFeeInput): GatewayFeeResult {
  const gross = Math.max(0, input.grossPaymentAmount);
  const rate = Math.max(0, input.percentageFeeRate);
  const percentageFeeAmount = roundToTwo((gross * rate) / 100);
  const fixedFee = Math.max(0, input.fixedFeeAmount || 0);
  const taxOnFee = Math.max(0, input.taxOnFeeAmount || 0);
  const conversionFee = Math.max(0, input.currencyConversionFee || 0);
  const bankCharge = Math.max(0, input.bankCharge || 0);

  const totalGatewayDeduction = roundToTwo(percentageFeeAmount + fixedFee + taxOnFee + conversionFee + bankCharge);
  const netSettlementAmount = Math.max(0, roundToTwo(gross - totalGatewayDeduction));

  return {
    grossPaymentAmount: gross,
    percentageFeeAmount,
    fixedFeeAmount: fixedFee,
    taxOnFeeAmount: taxOnFee,
    currencyConversionFee: conversionFee,
    bankCharge,
    totalGatewayDeduction,
    netSettlementAmount
  };
}

