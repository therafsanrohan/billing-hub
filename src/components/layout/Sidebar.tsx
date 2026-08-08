'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Package, ReceiptText, MoreHorizontal } from 'lucide-react';
import { cn } from './BottomNav';

const navItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'POS Terminal', href: '/pos', icon: LayoutGrid },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Sales', href: '/sales', icon: ReceiptText },
  { name: 'More', href: '/more', icon: MoreHorizontal },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Billing Hub</h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
                isActive 
                  ? "bg-primary-50 text-primary-700" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon 
                className={cn(
                  "w-5 h-5",
                  isActive ? "text-primary-600" : "text-slate-400"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
