import { create } from 'zustand';
import type { Product, ProductVariant } from '@/types/database';

export interface CartItem {
  id: string; // unique ID for cart row, e.g. product_id or variant_id
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  discount: number; // item level discount
}

interface CartState {
  items: CartItem[];
  globalDiscount: number;
  deliveryCharge: number;
  taxAmount: number;
  
  addItem: (product: Product, variant?: ProductVariant) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  setGlobalDiscount: (amount: number) => void;
  setDeliveryCharge: (amount: number) => void;
  clearCart: () => void;
  
  // Computed
  getSubtotal: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  globalDiscount: 0,
  deliveryCharge: 0,
  taxAmount: 0,

  addItem: (product, variant) => {
    set((state) => {
      const id = variant ? variant.id : product.id;
      const existingItem = state.items.find(i => i.id === id);
      
      if (existingItem) {
        return {
          items: state.items.map(i => 
            i.id === id ? { ...i, quantity: i.quantity + 1 } : i
          )
        };
      }

      const unitPrice = variant?.selling_price || product.selling_price;
      
      return {
        items: [...state.items, {
          id,
          product,
          variant,
          quantity: 1,
          unitPrice,
          discount: 0
        }]
      };
    });
  },

  updateQuantity: (id, delta) => {
    set((state) => ({
      items: state.items.map(i => {
        if (i.id === id) {
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      })
    }));
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter(i => i.id !== id)
    }));
  },

  setGlobalDiscount: (amount) => set({ globalDiscount: amount }),
  setDeliveryCharge: (amount) => set({ deliveryCharge: amount }),
  clearCart: () => set({ items: [], globalDiscount: 0, deliveryCharge: 0, taxAmount: 0 }),

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + (item.quantity * item.unitPrice) - item.discount, 0);
  },

  getTotal: () => {
    const state = get();
    const subtotal = state.getSubtotal();
    return subtotal - state.globalDiscount + state.deliveryCharge + state.taxAmount;
  }
}));
