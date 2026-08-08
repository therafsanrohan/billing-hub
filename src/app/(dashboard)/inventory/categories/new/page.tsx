'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function NewCategoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error('Category name is required');
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

      const { error } = await supabase.from('categories').insert({
        business_id: businessId,
        name,
        description: description || null,
      });

      if (error) throw error;
      
      toast.success('Category created successfully');
      router.push('/inventory/categories');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-2xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/inventory/categories" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add Category</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category Name *</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Beverages"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</label>
            <textarea 
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-primary-600 text-white font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {loading ? 'Saving...' : 'Save Category'}
        </button>
      </form>
    </div>
  );
}
