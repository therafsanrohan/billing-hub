import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { PackagePlus, FolderTree, AlertCircle, Search } from 'lucide-react';
import type { Product } from '@/types/database';

export default async function InventoryPage() {
  const supabase = await createClient();
  
  // Note: For Sprint 1, we assume a single business context per user for simplicity
  // We fetch the first business the user belongs to
  const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
  const businessId = memberData?.business_id;

  let products: Product[] = [];
  if (businessId) {
    const { data } = await supabase.from('products').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
    products = data || [];
  }

  // Calculate stats
  const totalProducts = products.length;
  // Temporary fake stock for UI purposes until we wire up the RPC get_current_stock for lists efficiently
  const lowStockProducts = 0; 

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto h-screen flex flex-col">
      <header className="mb-4 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory</h1>
          <p className="text-sm text-slate-500 font-medium">Manage products & stock</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/categories" className="p-2 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-sm">
            <FolderTree size={20} />
          </Link>
          <Link href="/inventory/products/new" className="p-2 bg-primary-600 text-white rounded-xl shadow-sm">
            <PackagePlus size={20} />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Products</p>
          <p className="text-xl font-bold text-slate-900">{totalProducts}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Low Stock</p>
            <p className="text-xl font-bold text-red-700">{lowStockProducts}</p>
          </div>
          <AlertCircle className="text-red-400" size={24} />
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Search products, SKU..." 
          className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
        />
      </div>

      <div className="space-y-3">
        {products.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-xl shadow-sm">
            <PackagePlus className="mx-auto text-slate-300 mb-3" size={32} />
            <h3 className="text-slate-900 font-medium mb-1">No products found</h3>
            <p className="text-sm text-slate-500 mb-4">Add your first product to get started.</p>
            <Link href="/inventory/products/new" className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg">
              Add Product
            </Link>
          </div>
        ) : (
          products.map(product => (
            <Link href={`/inventory/products/${product.id}`} key={product.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-center hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <PackagePlus className="text-slate-400" size={20} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-900 truncate">{product.name}</h4>
                <p className="text-xs text-slate-500 truncate">{product.sku || 'No SKU'} • ৳{product.selling_price}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">--</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">In Stock</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
