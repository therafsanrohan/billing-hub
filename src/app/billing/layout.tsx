'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { db, isDemoMode, Profile } from '@/lib/db';
import { authService } from '@/lib/services/authService';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronDown,
  Percent,
  Mail,
  Calculator,
  Wallet,
  Landmark
} from 'lucide-react';

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    // Check auth
    async function loadAuth() {
      const user = await db.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUser(user);
      
      const allProfiles = await db.getProfiles();
      setProfiles(allProfiles);
    }
    loadAuth();
  }, [router]);

  const handleRoleChange = async (roleName: string) => {
    const matched = profiles.find(p => p.role_name === roleName);
    if (matched) {
      await db.setCurrentUser(matched);
      setCurrentUser(matched);
      setRoleDropdownOpen(false);
      setUserMenuOpen(false);
      setSidebarOpen(false);
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
    setRoleDropdownOpen(false);
    await authService.logout();
    window.location.href = '/login';
  };

  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f4eb]">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#100e09] border-t-transparent" />
          <p className="text-sm text-gray-500">Loading Billing Portal session...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Dashboard', href: '/billing', icon: LayoutDashboard },
    { label: 'Clients', href: '/billing/clients', icon: Users },
    { label: 'Invoices', href: '/billing/invoices', icon: FileText },
    { label: 'Payments', href: '/billing/payments', icon: CreditCard },
    { label: 'Reports', href: '/billing/reports', icon: BarChart3 },
    { label: 'Tax Ledger', href: '/billing/tax', icon: Calculator, customMatch: '/billing/tax' },
    { label: 'Reserve & Savings', href: '/billing/reserve', icon: Landmark, customMatch: '/billing/reserve' },
    { label: 'Cashflow', href: '/billing/expenses', icon: Wallet, customMatch: '/billing/expenses' },
    { label: 'Inbox', href: '/billing/inbox', icon: Mail },
    { label: 'Team', href: '/billing/team', icon: Shield },
    { label: 'Entity Settings', href: '/billing/settings/entities', icon: Settings, customMatch: '/billing/settings/entities' },
    { label: 'Gateway Rates', href: '/billing/settings/gateway-rates', icon: Percent, customMatch: '/billing/settings/gateway-rates' },
  ];

  const filteredNavItems = navItems.filter((item) => {
    const role = currentUser?.role_name;
    if (item.label === 'Team') {
      return role === 'Super Admin' || role === 'Admin';
    }
    if (item.label === 'Tax Ledger') {
      return role === 'Super Admin' || role === 'Admin' || role === 'Finance Admin';
    }
    if (item.label === 'Reserve & Savings') {
      return role === 'Super Admin' || role === 'Admin' || role === 'Finance Admin';
    }
    if (item.label === 'Cashflow') {
      return role === 'Super Admin' || role === 'Admin' || role === 'Finance Admin';
    }
    if (item.label === 'Entity Settings') {
      return role === 'Super Admin' || role === 'Finance Admin';
    }
    if (item.label === 'Gateway Rates') {
      return role === 'Super Admin' || role === 'Admin' || role === 'Finance Admin';
    }
    return true;
  });

  const isLinkActive = (item: typeof navItems[0]) => {
    if (item.customMatch && pathname.startsWith(item.customMatch)) {
      return true;
    }
    return pathname === item.href || (item.href !== '/billing' && pathname.startsWith(item.href));
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f4eb] text-[#1E1E1E]">
      


      <div className="flex flex-1">
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-gray-100 bg-[#f5f4eb] p-4 space-y-6 no-print">
          <div className="flex flex-col items-start space-y-2 px-2 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/SVG/corevow-logo.svg"
              alt="Corevow logo"
              className="h-8 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logos/app%20logo.svg'; }}
            />
            <div className="min-w-0">
              <span className="text-md font-bold tracking-tight block leading-tight text-gray-500">Billing Desk</span>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(item);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-[#100e09]/5 text-[#100e09]'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User profile section */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center justify-between px-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{currentUser.full_name}</p>
                <span className="text-[10px] text-[#100e09] font-extrabold uppercase tracking-wider block">{currentUser.role_name}</span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center space-x-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Header / Navigation */}
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex md:hidden items-center justify-between border-b border-gray-100 bg-[#f5f4eb] px-4 py-3.5 no-print relative z-50">
            <div className="flex items-center space-x-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/SVG/corevow-logo.svg"
                alt="app"
                className="h-6 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logos/app%20logo.svg'; }}
              />
              <span className="font-bold text-xs text-gray-500">Billing Desk</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Mobile Quick User Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setSidebarOpen(false);
                  }}
                  className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-full bg-[#100e09] text-[#f5f4eb] flex items-center justify-center text-[10px] font-extrabold shrink-0">
                    {currentUser.full_name.charAt(0)}
                  </span>
                  <span className="max-w-[70px] truncate">{currentUser.full_name.split(' ')[0]}</span>
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#f5f4eb] border border-gray-100 shadow-2xl p-3 z-50 space-y-3">
                    <div className="border-b border-gray-50 pb-2">
                      <p className="text-xs font-bold text-gray-900 truncate">{currentUser.full_name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{currentUser.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-red-50 text-[#100e09]">
                        {currentUser.role_name}
                      </span>
                    </div>

                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center justify-center space-x-2 rounded-xl bg-red-50 hover:bg-red-100 py-2.5 text-xs font-bold text-red-600 transition cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setSidebarOpen(!sidebarOpen);
                  setUserMenuOpen(false);
                }}
                className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 focus:outline-none cursor-pointer"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </header>

          {/* Mobile Fullscreen Navigation menu */}
          {sidebarOpen && (
            <div className="md:hidden fixed inset-0 top-[57px] bg-[#f5f4eb] z-50 p-5 flex flex-col justify-between overflow-y-auto pb-28 no-print">
              <nav className="space-y-1.5">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isLinkActive(item);
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                        active
                          ? 'bg-[#100e09]/5 text-[#100e09]'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-gray-100 pt-4 mt-6 space-y-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{currentUser.full_name}</p>
                  <p className="text-xs text-gray-400 font-semibold">{currentUser.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-red-50 text-[#100e09]">
                    {currentUser.role_name}
                  </span>
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-red-50 hover:bg-red-100 py-3 text-sm font-bold text-red-600 cursor-pointer shadow-xs transition"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-[#f5f4eb]/95 backdrop-blur-md flex items-center justify-around py-2 px-2 no-print z-40" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            {navItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(item);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex flex-col items-center space-y-1 ${
                    active ? 'text-[#100e09]' : 'text-gray-400 hover:text-gray-650'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex flex-col items-center space-y-1 text-gray-400 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-semibold">More</span>
            </button>
          </nav>

        </div>
      </div>
    </div>
  );
}
