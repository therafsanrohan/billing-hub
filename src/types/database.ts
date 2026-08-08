export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  phone?: string;
}

export interface Business {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  image_url?: string;
  cost_price: number;
  selling_price: number;
  discount_price?: number;
  low_stock_level: number;
  has_variants: boolean;
  is_active: boolean;
}

export interface ProductVariant {
  id: string;
  business_id: string;
  product_id: string;
  name: string;
  sku?: string;
  barcode?: string;
  cost_price?: number;
  selling_price?: number;
  low_stock_level?: number;
  is_active: boolean;
}

export type MovementType = 'PURCHASE' | 'SALE' | 'RETURN' | 'DAMAGE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'OPENING_STOCK' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export interface InventoryMovement {
  id: string;
  business_id: string;
  location_id: string;
  product_id: string;
  variant_id?: string;
  movement_type: MovementType;
  quantity: number;
  reference_type?: string;
  reference_id?: string;
  unit_cost?: number;
  note?: string;
  created_by?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  total_spent: number;
}

export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';

export interface Order {
  id: string;
  business_id: string;
  customer_id?: string;
  location_id?: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  delivery_charge: number;
  total_amount: number;
  notes?: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
}

export type PaymentMethod = 'CASH' | 'BKASH' | 'NAGAD' | 'CARD' | 'BANK_TRANSFER';

export interface Payment {
  id: string;
  business_id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  reference_number?: string;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface Expense {
  id: string;
  business_id: string;
  category_id: string;
  amount: number;
  date: string;
  reference_number?: string;
  note?: string;
  created_by?: string;
  created_at: string;
}
