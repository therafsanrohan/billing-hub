import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Plus, Folder } from 'lucide-react';
import type { Category } from '@/types/database';

export default async function CategoriesPage() {
  const supabase = await createClient();
  
  const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
  const businessId = memberData?.business_id;

  let categories: Category[] = [];
  if (businessId) {
    const { data } = await supabase.from('categories').select('*').eq('business_id', businessId).order('name', { ascending: true });
    categories = data || [];
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Categories</h1>
        </div>
        <button className="p-2 bg-primary-600 text-white rounded-xl shadow-sm">
          <Plus size={20} />
        </button>
      </header>

      <div className="space-y-3">
        {categories.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Folder className="mx-auto text-slate-300 mb-3" size={32} />
            <p className="text-sm text-slate-500 mb-4">No categories yet.</p>
          </div>
        ) : (
          categories.map(category => (
            <div key={category.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <span className="font-medium text-slate-900">{category.name}</span>
              <span className="text-xs text-slate-400">Edit</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
