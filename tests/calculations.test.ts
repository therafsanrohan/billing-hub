import { calculateTotals, formatCurrency } from '../src/lib/calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function runTests() {
  console.log('Running calculations tests...');

  // Test 1: Single line item
  const test1 = calculateTotals({
    items: [{ quantity: 1, rate: 100 }],
    discountType: 'none',
    discountValue: 0,
    vatRate: 0,
    vatInclusive: true
  });
  assert(test1.subtotal === 100, 'Test 1: Subtotal is 100');
  assert(test1.totalPayable === 100, 'Test 1: Total payable is 100');
  assert(test1.amountDue === 100, 'Test 1: Amount due is 100');

  // Test 2: Multiple line items with decimals
  const test2 = calculateTotals({
    items: [
      { quantity: 2.5, rate: 100.5 },
      { quantity: 1, rate: 49.99 }
    ],
    discountType: 'none',
    discountValue: 0,
    vatRate: 0,
    vatInclusive: true
  });
  // 2.5 * 100.5 = 251.25
  // 1 * 49.99 = 49.99
  // Subtotal = 301.24
  assert(test2.subtotal === 301.24, `Test 2: Subtotal is ${test2.subtotal} (expected 301.24)`);

  // Test 3: Fixed discount
  const test3 = calculateTotals({
    items: [
      { quantity: 2, rate: 50 },
      { quantity: 1, rate: 100 }
    ],
    discountType: 'fixed',
    discountValue: 15.5,
    vatRate: 0,
    vatInclusive: true
  });
  // Subtotal = 200, discount = 15.5, payable = 184.50
  assert(test3.subtotal === 200, 'Test 3: Subtotal is 200');
  assert(test3.discountAmount === 15.5, 'Test 3: Discount is 15.50');
  assert(test3.totalPayable === 184.5, `Test 3: Total payable is ${test3.totalPayable} (expected 184.50)`);

  // Test 4: Percentage discount
  const test4 = calculateTotals({
    items: [
      { quantity: 3, rate: 100 }
    ],
    discountType: 'percentage',
    discountValue: 15, // 15%
    vatRate: 0,
    vatInclusive: true
  });
  // Subtotal = 300, discount = 45, payable = 255
  assert(test4.subtotal === 300, 'Test 4: Subtotal is 300');
  assert(test4.discountAmount === 45, 'Test 4: Discount is 45');
  assert(test4.totalPayable === 255, 'Test 4: Total payable is 255');

  // Test 5: VAT inclusive calculations (breakdown)
  const test5 = calculateTotals({
    items: [
      { quantity: 1, rate: 115 }
    ],
    discountType: 'none',
    discountValue: 0,
    vatRate: 15,
    vatInclusive: true
  });
  // Subtotal = 115, total payable = 115
  // Vat inclusive breakdown: 115 - (115 / 1.15) = 15
  assert(test5.totalPayable === 115, 'Test 5: Total payable is 115');
  assert(test5.vatAmount === 15, `Test 5: VAT amount breakdown is ${test5.vatAmount} (expected 15)`);

  // Test 6: Partial and Full payments
  const test6 = calculateTotals({
    items: [{ quantity: 1, rate: 1000 }],
    discountType: 'none',
    discountValue: 0,
    vatRate: 0,
    vatInclusive: true,
    payments: [
      { amount: 300 },
      { amount: 450.5 }
    ]
  });
  // Subtotal = 1000, paid = 750.50, due = 249.50
  assert(test6.amountPaid === 750.5, `Test 6: Paid is ${test6.amountPaid} (expected 750.50)`);
  assert(test6.amountDue === 249.5, `Test 6: Due is ${test6.amountDue} (expected 249.50)`);

  // Test 7: Overpayment prevention
  const test7 = calculateTotals({
    items: [{ quantity: 1, rate: 100 }],
    discountType: 'none',
    discountValue: 0,
    vatRate: 0,
    vatInclusive: true,
    payments: [
      { amount: 150 } // overpayment
    ]
  });
  assert(test7.amountPaid === 150, 'Test 7: Paid is 150');
  assert(test7.amountDue === 0, 'Test 7: Due is 0 (cannot be negative)');

  // Test 8: Currency formatting
  assert(formatCurrency(125000.5, 'BDT') === '৳1,25,000.5', 'Test 8 BDT format');
  assert(formatCurrency(1250.5, 'USD') === '$1,250.50', 'Test 8 USD format');

  console.log('All calculations tests passed successfully!');
}

try {
  runTests();
} catch (error: any) {
  console.error('❌ Test execution failed!');
  console.error(error.message);
  process.exit(1);
}
