import Link from 'next/link';
import { Plus, Gift, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function DiscountsPage() {
  const supabase = await createClient();
  const { data: member } = await supabase.from('business_members').select('business_id').limit(1).single();
  
  let discounts: any[] = [];
  if (member?.business_id) {
    const { data } = await supabase.from('discounts').select('*').eq('business_id', member.business_id).order('created_at', { ascending: false });
    if (data) discounts = data;
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/more" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Discounts</h1>
        </div>
        <Link 
          href="/discounts/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Discount</span>
        </Link>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {discounts.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {discounts.map((discount) => (
              <div key={discount.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Gift size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      {discount.name}
                      {!discount.is_active && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded uppercase font-bold tracking-wider">Inactive</span>}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Value: {discount.type === 'PERCENTAGE' ? `${discount.value}%` : `$${discount.value}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <Gift size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No discounts found</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm">Create global discounts to easily apply them during checkout.</p>
            <Link 
              href="/discounts/new"
              className="bg-primary-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors"
            >
              Create Discount
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
