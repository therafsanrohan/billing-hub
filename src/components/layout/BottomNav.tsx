'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Package, ReceiptText, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'POS', href: '/pos', icon: LayoutGrid },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Sales', href: '/sales', icon: ReceiptText },
  { name: 'More', href: '/more', icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 pb-safe">
      <div className="flex h-16 w-full mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center touch-target gap-1"
            >
              <Icon 
                className={cn(
                  "w-6 h-6",
                  isActive ? "text-primary-600" : "text-slate-500"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span 
                className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-primary-600" : "text-slate-500"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
