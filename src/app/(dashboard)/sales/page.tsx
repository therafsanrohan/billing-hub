import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ReceiptText, Search, CreditCard, Banknote } from 'lucide-react';
import type { Order } from '@/types/database';

export default async function SalesPage() {
  const supabase = await createClient();
  
  const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
  const businessId = memberData?.business_id;

  let orders: Order[] = [];
  if (businessId) {
    const { data } = await supabase.from('orders').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
    orders = data || [];
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-orange-100 text-orange-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales</h1>
          <p className="text-sm text-slate-500 font-medium">Recent transactions</p>
        </div>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Search order number..." 
          className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
        />
      </div>

      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-xl shadow-sm">
            <ReceiptText className="mx-auto text-slate-300 mb-3" size={32} />
            <h3 className="text-slate-900 font-medium mb-1">No sales yet</h3>
            <p className="text-sm text-slate-500">Orders will appear here once you make a sale in POS.</p>
          </div>
        ) : (
          orders.map(order => (
            <Link href={`/sales/${order.id}`} key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between active:bg-slate-50 transition-colors">
              <div>
                <h4 className="font-semibold text-slate-900">{order.order_number}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">৳{order.total_amount}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5 text-slate-500">
                  {order.payment_status === 'PAID' ? <Banknote size={12} /> : <CreditCard size={12} />}
                  <span className="text-[10px] font-medium uppercase">{order.payment_status}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
