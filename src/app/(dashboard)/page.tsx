import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowRight, Wallet, Receipt, Users, Package } from 'lucide-react';

export default async function DashboardHomePage() {
  const supabase = await createClient();
  
  const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
  const businessId = memberData?.business_id;

  let todaySales = 0;
  let todayOrders = 0;
  let totalCustomers = 0;
  let totalProducts = 0;

  if (businessId) {
    // Get today's start and end in ISO
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.toISOString();
    
    // Fetch today's orders
    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('business_id', businessId)
      .gte('created_at', startOfDay);

    if (orders) {
      todayOrders = orders.length;
      todaySales = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    }

    // Fetch counts
    const { count: cCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', businessId);
    totalCustomers = cCount || 0;

    const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('is_active', true);
    totalProducts = pCount || 0;
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto pb-24 md:pb-8">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm md:text-base text-slate-500 font-medium">Business Overview</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-primary-600 p-6 rounded-2xl shadow-sm text-white md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <Wallet size={16} />
            <p className="text-xs font-semibold uppercase tracking-wider">Today's Sales</p>
          </div>
          <p className="text-3xl font-bold">৳{todaySales.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Receipt size={16} />
            <p className="text-xs font-semibold uppercase tracking-wider">Orders</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{todayOrders}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Users size={14} />
            <p className="text-xs font-medium uppercase tracking-wider">Customers</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCustomers}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Package size={14} />
            <p className="text-xs font-medium uppercase tracking-wider">Products</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalProducts}</p>
        </div>
      </div>

      <Link href="/pos" className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform shadow-md">
        <div>
          <h2 className="font-bold text-lg">Open POS Terminal</h2>
          <p className="text-slate-300 text-sm">Start a new transaction</p>
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <ArrowRight size={20} />
        </div>
      </Link>
    </div>
  );
}
