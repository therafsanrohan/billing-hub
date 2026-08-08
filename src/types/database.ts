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
