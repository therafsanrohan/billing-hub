import { Store, Receipt, Printer, Bell, Users, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const sections = [
    {
      title: 'Business',
      items: [
        { name: 'Store Details', icon: Store, description: 'Name, address, currency' },
        { name: 'Staff & Branches', icon: Users, description: 'Manage employee access' },
      ]
    },
    {
      title: 'POS & Printing',
      items: [
        { name: 'Receipt Settings', icon: Receipt, description: 'Logo, footer text' },
        { name: 'Printers', icon: Printer, description: 'Connect Bluetooth/Network printer' },
      ]
    },
    {
      title: 'Alerts',
      items: [
        { name: 'Notifications', icon: Bell, description: 'Low stock & daily reports' },
      ]
    }
  ];

  return (
    <div className="p-4 max-w-md mx-auto pb-24 bg-slate-50 min-h-screen">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/more" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-700">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
      </header>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div key={idx}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">{section.title}</h2>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {section.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button 
                    key={item.name} 
                    className={`w-full flex items-center gap-4 p-4 text-left active:bg-slate-50 transition-colors ${
                      i !== section.items.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                  >
                    <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center shrink-0">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{item.name}</h3>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
