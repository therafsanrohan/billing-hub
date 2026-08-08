import Link from 'next/link';
import { Plus, Users, ArrowLeft, Phone, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: member } = await supabase.from('business_members').select('business_id').limit(1).single();
  
  let customers: any[] = [];
  if (member?.business_id) {
    const { data } = await supabase.from('customers').select('*').eq('business_id', member.business_id).order('created_at', { ascending: false });
    if (data) customers = data;
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/more" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customers</h1>
        </div>
        <Link 
          href="/customers/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Customer</span>
        </Link>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {customers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <div key={customer.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{customer.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} /> {customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} /> {customer.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No customers yet</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm">Keep track of your regular customers and their purchase history.</p>
            <Link 
              href="/customers/new"
              className="bg-primary-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors"
            >
              Add Customer
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
