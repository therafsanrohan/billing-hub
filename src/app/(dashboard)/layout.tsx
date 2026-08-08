import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0 h-screen overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
