import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Printer } from 'lucide-react';
import PrintButton from './print-button';

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  
  // Fetch order details
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name))')
    .eq('id', params.id)
    .single();

  if (error || !order) {
    notFound();
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-200">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="font-bold text-slate-900">Receipt #{order.id.slice(0, 8)}</h1>
        </div>
        <PrintButton />
      </div>

      <div className="p-4 max-w-sm mx-auto">
        {/* Receipt Container - Styling optimized for 58mm/80mm thermal printers */}
        <div id="receipt-area" className="bg-white p-4 print:p-0 rounded-xl shadow-sm print:shadow-none border border-slate-200 print:border-none">
          <div className="text-center mb-4">
            <h2 className="font-bold text-xl uppercase tracking-wider mb-1">Corevow Store</h2>
            <p className="text-xs text-slate-500 font-mono">Receipt: {order.id.split('-')[0].toUpperCase()}</p>
            <p className="text-xs text-slate-500 font-mono">{new Date(order.created_at).toLocaleString()}</p>
          </div>

          <div className="border-t border-dashed border-slate-300 print:border-black my-4"></div>

          <table className="w-full text-sm font-mono mb-4">
            <thead>
              <tr className="border-b border-dashed border-slate-300 print:border-black">
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Price</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((item: any) => (
                <tr key={item.id}>
                  <td className="py-2 text-slate-700 print:text-black">
                    {item.products?.name}
                    {item.discount > 0 && <div className="text-[10px] text-slate-500">-৳{item.discount} disc</div>}
                  </td>
                  <td className="text-right py-2 text-slate-700 print:text-black">{item.quantity}</td>
                  <td className="text-right py-2 text-slate-700 print:text-black">৳{(item.unit_price * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-slate-300 print:border-black my-4"></div>

          <div className="space-y-1 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-slate-600 print:text-black">Subtotal:</span>
              <span className="font-semibold text-slate-900 print:text-black">৳{order.subtotal.toLocaleString()}</span>
            </div>
            {order.tax_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 print:text-black">Tax:</span>
                <span className="font-semibold text-slate-900 print:text-black">৳{order.tax_amount.toLocaleString()}</span>
              </div>
            )}
            {order.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 print:text-black">Discount:</span>
                <span className="font-semibold text-slate-900 print:text-black">-৳{order.discount_amount.toLocaleString()}</span>
              </div>
            )}
            
            <div className="border-t border-dashed border-slate-300 print:border-black my-2"></div>
            
            <div className="flex justify-between text-lg font-bold">
              <span className="text-slate-900 print:text-black">Total:</span>
              <span className="text-slate-900 print:text-black">৳{order.total_amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="text-center mt-8 font-mono text-xs text-slate-500 print:text-black">
            <p>Thank you for shopping with us!</p>
            <p>Powered by Billing Hub</p>
          </div>
        </div>
      </div>
    </div>
  );
}
