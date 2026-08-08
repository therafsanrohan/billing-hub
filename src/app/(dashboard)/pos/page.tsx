import { createClient } from '@/lib/supabase/server';
import POSClient from './pos-client';
import type { Product } from '@/types/database';

export default async function POSPage() {
  const supabase = await createClient();
  
  const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
  const businessId = memberData?.business_id;

  let products: Product[] = [];
  if (businessId) {
    // In a real app we'd paginate or use an autocomplete API. For Sprint 2 we load active products
    const { data } = await supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true);
    products = data || [];
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50">
      <header className="px-4 py-3 bg-white border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Point of Sale</h1>
      </header>
      
      <div className="flex-1 overflow-hidden relative">
        <POSClient initialProducts={products} businessId={businessId!} />
      </div>
    </div>
  );
}
