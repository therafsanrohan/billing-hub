'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function NewTaxPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    rate_percentage: '',
    is_default: false,
    is_active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rate_percentage) {
      toast.error('Please fill all required fields');
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

      // If setting as default, we should ideally unset others, but for simplicity we'll just insert
      const { error } = await supabase.from('taxes').insert({
        business_id: businessId,
        name: formData.name,
        rate_percentage: parseFloat(formData.rate_percentage),
        is_default: formData.is_default,
        is_active: formData.is_active,
      });

      if (error) throw error;
      
      toast.success('Tax rate created successfully');
      router.push('/tax');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save tax rate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-2xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/tax" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add Tax Rate</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tax Name *</label>
            <input 
              required
              type="text" 
              placeholder="e.g. VAT (15%)"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Rate Percentage (%) *</label>
            <input 
              required
              type="number" 
              step="0.01"
              min="0"
              max="100"
              placeholder="15.00"
              value={formData.rate_percentage}
              onChange={e => setFormData({...formData, rate_percentage: e.target.value})}
              className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Set as Default</h3>
              <p className="text-xs text-slate-500 mt-1">Automatically apply this tax to all new POS orders.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={formData.is_default}
                onChange={e => setFormData({...formData, is_default: e.target.checked})}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-primary-600 text-white font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {loading ? 'Saving...' : 'Save Tax Rate'}
        </button>
      </form>
    </div>
  );
}
