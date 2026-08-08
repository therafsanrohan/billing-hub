import Link from 'next/link';
import { Users, FileText, Settings, HelpCircle, LogOut, ChevronRight, Calculator, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function MorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const menuItems = [
    {
      group: 'Management',
      items: [
        { name: 'Customers', icon: Users, href: '/customers', color: 'text-blue-500', bg: 'bg-blue-100' },
        { name: 'Expenses', icon: FileText, href: '/expenses', color: 'text-rose-500', bg: 'bg-rose-100' },
        { name: 'Tax & VAT', icon: Calculator, href: '/more', color: 'text-amber-500', bg: 'bg-amber-100' },
        { name: 'Discounts', icon: Gift, href: '/more', color: 'text-emerald-500', bg: 'bg-emerald-100' },
      ]
    },
    {
      group: 'App',
      items: [
        { name: 'Settings', icon: Settings, href: '/settings', color: 'text-slate-500', bg: 'bg-slate-100' },
        { name: 'Help & Support', icon: HelpCircle, href: '/more', color: 'text-purple-500', bg: 'bg-purple-100' },
      ]
    }
  ];

  return (
    <div className="p-4 max-w-md mx-auto pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">More</h1>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xl">
          {user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{user?.email || 'User'}</h3>
          <p className="text-xs text-slate-500">Business Owner</p>
        </div>
      </div>

      <div className="space-y-6">
        {menuItems.map((group, idx) => (
          <div key={idx}>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">{group.group}</h4>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {group.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    className={`flex items-center justify-between p-4 active:bg-slate-50 transition-colors ${
                      i !== group.items.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.bg} ${item.color}`}>
                        <Icon size={18} />
                      </div>
                      <span className="font-semibold text-slate-700">{item.name}</span>
                    </div>
                    <ChevronRight size={18} className="text-slate-400" />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <form action="/auth/signout" method="post">
          <button type="submit" className="w-full bg-red-50 text-red-600 font-bold p-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <LogOut size={18} /> Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
