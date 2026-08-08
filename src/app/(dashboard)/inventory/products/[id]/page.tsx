'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const productId = resolvedParams.id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [receiveQuantity, setReceiveQuantity] = useState('0');
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category_id: '',
    selling_price: '',
    cost_price: '',
    low_stock_level: '',
  });

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      
      const { data: member } = await supabase.from('business_members').select('business_id').limit(1).single();
      if (!member?.business_id) return;
      
      const businessId = member.business_id;

      // Load Categories
      const { data: catData } = await supabase.from('categories').select('*').eq('business_id', businessId);
      if (catData) setCategories(catData);

      // Load Product
      const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
      if (product) {
        setFormData({
          name: product.name || '',
          sku: product.sku || '',
          category_id: product.category_id || '',
          selling_price: product.selling_price?.toString() || '',
          cost_price: product.cost_price?.toString() || '',
          low_stock_level: product.low_stock_level?.toString() || '5',
        });
      }

      // Calculate Stock
      const { data: movements } = await supabase.from('inventory_movements').select('movement_type, quantity').eq('product_id', productId);
      if (movements) {
        const total = movements.reduce((acc, mov) => {
          return acc + (mov.movement_type === 'IN' ? mov.quantity : -mov.quantity);
        }, 0);
        setCurrentStock(total);
      }

      setLoading(false);
    }
    loadData();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase.from('products').update({
        name: formData.name,
        sku: formData.sku || null,
        category_id: formData.category_id || null,
        selling_price: parseFloat(formData.selling_price),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        low_stock_level: parseInt(formData.low_stock_level || '0'),
      }).eq('id', productId);

      if (error) throw error;
      
      toast.success('Product updated successfully');
      router.push('/inventory');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const handleReceiveStock = async () => {
    const qty = parseInt(receiveQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    try {
      const supabase = createClient();
      const { data: member } = await supabase.from('business_members').select('business_id').limit(1).single();
      if (!member?.business_id) throw new Error('No business context');
      
      const { data: locData } = await supabase.from('inventory_locations')
          .select('id').eq('business_id', member.business_id).eq('is_default', true).limit(1).single();
        
      let locationId = locData?.id;
      if (!locationId) {
        const { data: anyLoc } = await supabase.from('inventory_locations')
          .select('id').eq('business_id', member.business_id).limit(1).single();
        locationId = anyLoc?.id;
      }
      
      if (!locationId) throw new Error('No inventory location found');

      const { error } = await supabase.from('inventory_movements').insert({
        business_id: member.business_id,
        location_id: locationId,
        product_id: productId,
        movement_type: 'IN',
        quantity: qty,
        reference_type: 'MANUAL_RECEIPT'
      });

      if (error) throw error;

      toast.success(`Successfully received ${qty} items`);
      setCurrentStock(prev => prev + qty);
      setReceiveQuantity('0');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to receive stock');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-4 max-w-xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Edit Product</h1>
        </div>
      </header>

      {/* Stock Management Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Stock</p>
          <p className="text-3xl font-bold text-slate-900">{currentStock}</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="number"
            min="1"
            value={receiveQuantity}
            onChange={e => setReceiveQuantity(e.target.value)}
            className="w-24 px-3 h-10 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button 
            onClick={handleReceiveStock}
            className="h-10 px-4 bg-emerald-100 text-emerald-700 font-bold flex items-center gap-2 rounded-lg active:scale-95 transition-transform"
          >
            <PackagePlus size={16} />
            Receive Stock
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Product Name *</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">SKU</label>
              <input 
                type="text" 
                value={formData.sku}
                onChange={e => setFormData({...formData, sku: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</label>
              <select 
                value={formData.category_id}
                onChange={e => setFormData({...formData, category_id: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Selling Price *</label>
              <input 
                required
                type="number" 
                step="0.01"
                min="0"
                value={formData.selling_price}
                onChange={e => setFormData({...formData, selling_price: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cost Price</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={e => setFormData({...formData, cost_price: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
        
        <button 
          type="submit"
          disabled={saving}
          className="w-full h-14 flex items-center justify-center gap-2 bg-primary-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          <Save size={20} />
          <span>{saving ? 'Saving...' : 'Update Details'}</span>
        </button>
      </form>
    </div>
  );
}
