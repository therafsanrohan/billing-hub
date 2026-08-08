export default function DashboardHomePage() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Corevow</h1>
        <p className="text-sm text-slate-500 font-medium">Overview</p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Today's Sales</p>
          <p className="text-xl font-bold text-slate-900">৳0</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Orders</p>
          <p className="text-xl font-bold text-slate-900">0</p>
        </div>
      </div>

      <div className="bg-primary-50 rounded-xl p-4 border border-primary-100 mb-6">
        <h2 className="text-primary-900 font-semibold mb-2">Welcome to POS</h2>
        <p className="text-sm text-primary-700 mb-4">
          Start your first transaction by going to the POS screen.
        </p>
      </div>
    </div>
  );
}
