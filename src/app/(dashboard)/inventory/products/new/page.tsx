'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { validateForm, productSchema } from '@/lib/utils/validation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    selling_price: '',
    cost_price: '',
    low_stock_level: '5',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const validation = validateForm(productSchema, formData);
    if (!validation.success) {
      toast.error(validation.error);
      return;
    }

    setLoading(true);
    
    try {
      const supabase = createClient();
      
      const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
      const businessId = memberData?.business_id;

      if (!businessId) {
        toast.error('No business context found. Please ensure you have a business set up.');
        return;
      }

      const { error } = await supabase.from('products').insert({
        business_id: businessId,
        name: validation.data.name,
        sku: validation.data.sku || null,
        selling_price: validation.data.selling_price,
        cost_price: validation.data.cost_price,
        low_stock_level: validation.data.low_stock_level,
        is_active: true
      });

      if (error) throw error;
      
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
    <div className="p-4 max-w-md mx-auto">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">New Product</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Product Name *</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 h-12 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Fresh Orange Juice"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">SKU</label>
            <input 
              type="text" 
              value={formData.sku}
              onChange={e => setFormData({...formData, sku: e.target.value})}
              className="w-full px-3 h-12 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Selling Price *</label>
              <input 
                required
                type="number" 
                step="0.01"
                value={formData.selling_price}
                onChange={e => setFormData({...formData, selling_price: e.target.value})}
                className="w-full px-3 h-12 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cost Price</label>
              <input 
                type="number" 
                step="0.01"
                value={formData.cost_price}
                onChange={e => setFormData({...formData, cost_price: e.target.value})}
                className="w-full px-3 h-12 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
        
        <button 
          type="submit"
          disabled={loading}
          className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 text-white font-medium rounded-xl shadow-sm disabled:opacity-50"
        >
          <Save size={20} />
          <span>{loading ? 'Saving...' : 'Save Product'}</span>
        </button>
      </form>
    </div>
  );
}
