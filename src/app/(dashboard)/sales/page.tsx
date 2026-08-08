'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ReceiptText, Search, CreditCard, Banknote } from 'lucide-react';

export default function SalesPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchOrders() {
      const supabase = createClient();
      const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
      const businessId = memberData?.business_id;

      if (businessId) {
        const { data } = await supabase.from('orders')
          .select('*, payments!inner(payment_method)')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false });
        
        if (data) setOrders(data);
      }
      setLoading(false);
    }
    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-orange-100 text-orange-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const filteredOrders = orders.filter(order => 
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto pb-24 md:pb-8">
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
          placeholder="Search order number (e.g. INV-260809-0001)..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading sales...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-xl shadow-sm">
            <ReceiptText className="mx-auto text-slate-300 mb-3" size={32} />
            <h3 className="text-slate-900 font-medium mb-1">No sales found</h3>
            <p className="text-sm text-slate-500">
              {searchQuery ? "No orders match your search." : "Orders will appear here once you make a sale in POS."}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <Link href={`/sales/${order.id}`} key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:bg-slate-50 active:scale-[0.99] transition-all">
              <div>
                <h4 className="font-semibold text-slate-900">{order.order_number}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">৳{Number(order.total_amount).toFixed(2)}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5 text-slate-500">
                  {order.payments?.[0]?.payment_method === 'CASH' ? <Banknote size={12} /> : <CreditCard size={12} />}
                  <span className="text-[10px] font-medium uppercase">{order.payments?.[0]?.payment_method || 'CARD'}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
