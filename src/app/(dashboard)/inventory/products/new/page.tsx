'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { validateForm, productSchema } from '@/lib/utils/validation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category_id: '',
    selling_price: '',
    cost_price: '',
    initial_stock: '0',
    low_stock_level: '5',
  });

  useEffect(() => {
    async function loadCategories() {
      const supabase = createClient();
      const { data: member } = await supabase.from('business_members').select('business_id').limit(1).single();
      if (member?.business_id) {
        const { data } = await supabase.from('categories').select('*').eq('business_id', member.business_id);
        if (data) setCategories(data);
      }
    }
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Quick frontend validation for empty category
    if (!formData.name || !formData.selling_price) {
      toast.error('Name and Selling Price are required.');
      return;
    }

    setLoading(true);
    
    try {
      const supabase = createClient();
      
      const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
      const businessId = memberData?.business_id;

      if (!businessId) {
        toast.error('No business context found.');
        return;
      }

      // Insert Product
      const { data: product, error } = await supabase.from('products').insert({
        business_id: businessId,
        category_id: formData.category_id || null,
        name: formData.name,
        sku: formData.sku || null,
        selling_price: parseFloat(formData.selling_price),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        low_stock_level: parseInt(formData.low_stock_level),
        is_active: true
      }).select().single();

      if (error) throw error;

      // Handle Initial Stock
      const initialStock = parseInt(formData.initial_stock);
      if (initialStock > 0 && product) {
        // Find default location
        const { data: locData } = await supabase.from('inventory_locations')
          .select('id').eq('business_id', businessId).eq('is_default', true).limit(1).single();
        
        let locationId = locData?.id;
        
        // Fallback to any location if no default
        if (!locationId) {
          const { data: anyLoc } = await supabase.from('inventory_locations')
            .select('id').eq('business_id', businessId).limit(1).single();
          locationId = anyLoc?.id;
        }

        if (locationId) {
          const { error: moveError } = await supabase.from('inventory_movements').insert({
            business_id: businessId,
            location_id: locationId,
            product_id: product.id,
            movement_type: 'IN',
            quantity: initialStock,
            reference_type: 'INITIAL_STOCK'
          });
          if (moveError) console.error('Failed to add initial stock', moveError);
        }
      }
      
      toast.success('Product saved successfully');
      router.push('/inventory');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">New Product</h1>
        </div>
      </header>

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
              placeholder="e.g. Fresh Orange Juice"
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
                placeholder="Optional"
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
                placeholder="0.00"
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
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Initial Stock</label>
              <input 
                type="number" 
                min="0"
                value={formData.initial_stock}
                onChange={e => setFormData({...formData, initial_stock: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Low Stock Alert</label>
              <input 
                type="number" 
                min="0"
                value={formData.low_stock_level}
                onChange={e => setFormData({...formData, low_stock_level: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
        
        <button 
          type="submit"
          disabled={loading}
          className="w-full h-14 flex items-center justify-center gap-2 bg-primary-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          <Save size={20} />
          <span>{loading ? 'Saving...' : 'Save Product'}</span>
        </button>
      </form>
    </div>
  );
}
