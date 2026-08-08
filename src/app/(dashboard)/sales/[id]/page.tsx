import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Printer, Banknote, CreditCard } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      payments (*),
      order_items (
        id, quantity, unit_price, total_price, discount_amount,
        products (name, sku)
      ),
      customers (name, phone)
    `)
    .eq('id', resolvedParams.id)
    .single();

  if (error || !order) {
    notFound();
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-orange-100 text-orange-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const payment = order.payments?.[0];

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{order.order_number}</h1>
            <p className="text-sm text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
          </div>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
          {order.status}
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Order Items</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="p-6 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-slate-900">{item.products?.name || 'Unknown Product'}</h4>
                    <p className="text-sm text-slate-500">
                      {item.quantity} x ৳{Number(item.unit_price).toFixed(2)}
                      {Number(item.discount_amount) > 0 && ` (-৳${Number(item.discount_amount).toFixed(2)})`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">৳{Number(item.total_price).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-slate-900 mb-4">Summary</h3>
            
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium">৳{Number(order.subtotal).toFixed(2)}</span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount</span>
                <span className="font-medium">-৳{Number(order.discount_amount).toFixed(2)}</span>
              </div>
            )}
            {Number(order.tax_amount) > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax & VAT</span>
                <span className="font-medium">৳{Number(order.tax_amount).toFixed(2)}</span>
              </div>
            )}
            
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="font-bold text-slate-900">Total</span>
              <span className="text-xl font-black text-slate-900">৳{Number(order.total_amount).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">Payment</h3>
            {payment ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  {payment.payment_method === 'CASH' ? <Banknote size={20} /> : <CreditCard size={20} />}
                </div>
                <div>
                  <p className="font-bold text-slate-900 uppercase">{payment.payment_method}</p>
                  <p className="text-xs text-slate-500">{payment.status}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No payment details found.</p>
            )}
          </div>

          {/* Customer Info */}
          {order.customers && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4">Customer</h3>
              <p className="font-bold text-slate-900">{order.customers.name}</p>
              {order.customers.phone && <p className="text-sm text-slate-500">{order.customers.phone}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
