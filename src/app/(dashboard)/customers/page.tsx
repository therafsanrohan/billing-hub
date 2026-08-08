import { createClient } from '@/lib/supabase/server';
import { Users, Phone, MapPin } from 'lucide-react';
import type { Customer } from '@/types/database';

export default async function CustomersPage() {
  const supabase = await createClient();
  
  const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
  const businessId = memberData?.business_id;

  let customers: Customer[] = [];
  if (businessId) {
    const { data } = await supabase.from('customers').select('*').eq('business_id', businessId).order('name');
    customers = data || [];
  }

  return (
    <div className="p-4 max-w-md mx-auto pb-24">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customers</h1>
          <p className="text-sm text-slate-500 font-medium">Manage your client list</p>
        </div>
      </header>

      <div className="space-y-3">
        {customers.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Users className="mx-auto text-slate-300 mb-3" size={32} />
            <h3 className="text-slate-900 font-medium mb-1">No customers yet</h3>
            <p className="text-sm text-slate-500">Customers will appear here when you save them.</p>
          </div>
        ) : (
          customers.map(customer => (
            <div key={customer.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-900 text-base">{customer.name}</h4>
                <div className="space-y-1 mt-1">
                  {customer.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone size={12} /> {customer.phone}
                    </p>
                  )}
                  {customer.address && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={12} /> {customer.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">Total Spent</p>
                <p className="text-lg font-bold text-primary-600">৳{customer.total_spent}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
