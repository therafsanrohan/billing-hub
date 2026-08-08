'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import type { Product, Customer } from '@/types/database';
import { useCartStore } from '@/lib/store/useCartStore';
import { createClient } from '@/lib/supabase/client';

export default function POSClient({ initialProducts, customers, businessId }: { initialProducts: Product[], customers: Customer[], businessId: string }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cart = useCartStore();

  // Barcode Scanner Listener
  useEffect(() => {
    let barcode = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in the search input
      if (document.activeElement?.tagName === 'INPUT') return;

      const currentTime = Date.now();
      
      if (e.key === 'Enter') {
        if (barcode.length > 2) {
          // Find product by SKU
          const product = initialProducts.find(
            p => p.sku?.toLowerCase() === barcode.toLowerCase()
          );
          if (product) {
            cart.addItem(product);
          }
        }
        barcode = '';
      } else if (e.key.length === 1) { // Normal character
        // Barcode scanners type very fast
        if (currentTime - lastKeyTime > 50) {
          barcode = ''; // reset if it's too slow (manual typing)
        }
        barcode += e.key;
      }
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initialProducts, cart]);

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const supabase = createClient();
      const items = cart.items.map(item => ({
        product_id: item.product.id,
        variant_id: item.variant?.id || null,
        qty: item.quantity,
        price: item.unitPrice,
        discount: item.discount
      }));

      const { data, error } = await supabase.rpc('process_pos_order', {
        p_business_id: businessId,
        p_location_id: null,
        p_customer_id: selectedCustomerId,
        p_subtotal: cart.getSubtotal(),
        p_discount: cart.globalDiscount,
        p_tax: cart.taxAmount,
        p_delivery: cart.deliveryCharge,
        p_total: cart.getTotal(),
        p_items: items,
        p_payment_method: paymentMethod,
        p_payment_amount: cart.getTotal()
      });

      if (error) throw error;
      
      cart.clearCart();
      setShowCheckout(false);
      router.push('/sales');
    } catch (err) {
      console.error(err);
      alert('Checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = initialProducts.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Product List */}
      <div className="flex-1 flex flex-col h-1/2 md:h-full border-b md:border-b-0 md:border-r border-slate-200">
        <div className="p-4 bg-white border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar bg-slate-50">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => cart.addItem(product)}
                className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-left active:scale-95 transition-transform"
              >
                <div className="w-full aspect-square bg-slate-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="text-slate-300" size={24} />
                  )}
                </div>
                <h4 className="font-semibold text-slate-900 truncate text-sm">{product.name}</h4>
                <p className="text-primary-600 font-bold mt-1">৳{product.selling_price}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Area */}
      <div className="flex-1 flex flex-col h-1/2 md:h-full bg-white relative">
        {cart.items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <ShoppingBag size={48} className="mb-4 opacity-50" />
            <p>Cart is empty</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.items.map(item => (
              <div key={item.id} className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 text-sm">{item.product.name}</h4>
                  <p className="text-slate-500 text-xs">৳{item.unitPrice}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button onClick={() => cart.updateQuantity(item.id, -1)} className="p-1 bg-slate-100 rounded-full text-slate-600 active:bg-slate-200">
                    <Minus size={16} />
                  </button>
                  <span className="font-semibold w-6 text-center">{item.quantity}</span>
                  <button onClick={() => cart.updateQuantity(item.id, 1)} className="p-1 bg-slate-100 rounded-full text-slate-600 active:bg-slate-200">
                    <Plus size={16} />
                  </button>
                  
                  <button onClick={() => cart.removeItem(item.id)} className="p-2 text-red-500 ml-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between mb-2 text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-semibold">৳{cart.getSubtotal()}</span>
          </div>
          {cart.globalDiscount > 0 && (
            <div className="flex justify-between mb-2 text-sm text-green-600">
              <span>Discount</span>
              <span>-৳{cart.globalDiscount}</span>
            </div>
          )}
          <div className="flex justify-between mb-4 text-lg font-bold text-slate-900 border-t border-slate-100 pt-2">
            <span>Total</span>
            <span>৳{cart.getTotal()}</span>
          </div>
          
          <button 
            disabled={cart.items.length === 0}
            onClick={() => setShowCheckout(true)}
            className="w-full h-14 bg-primary-600 text-white font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            Checkout <span className="opacity-75">৳{cart.getTotal()}</span>
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-lg text-slate-900">Checkout</h2>
              <button onClick={() => setShowCheckout(false)} className="p-2 -mr-2 text-slate-500">
                Cancel
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="text-center mb-6">
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Due</p>
                <p className="text-4xl font-bold text-slate-900">৳{cart.getTotal()}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Customer (Optional)</label>
                  <select 
                    value={selectedCustomerId || ''}
                    onChange={(e) => setSelectedCustomerId(e.target.value || null)}
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['CASH', 'BKASH', 'CARD'].map(method => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`h-12 rounded-xl font-semibold border-2 transition-colors ${
                          paymentMethod === method 
                            ? 'border-primary-600 bg-primary-50 text-primary-700' 
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button 
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full h-14 bg-slate-900 text-white font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Processing...' : `Confirm ৳${cart.getTotal()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
