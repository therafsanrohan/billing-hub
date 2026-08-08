import { createClient } from '@/lib/supabase/server';
import { FileText, Plus, Calendar } from 'lucide-react';
import type { Expense, ExpenseCategory } from '@/types/database';

export default async function ExpensesPage() {
  const supabase = await createClient();
  
  const { data: memberData } = await supabase.from('business_members').select('business_id').limit(1).single();
  const businessId = memberData?.business_id;

  let expenses: (Expense & { category?: Pick<ExpenseCategory, 'name'> })[] = [];
  if (businessId) {
    const { data } = await supabase.from('expenses')
      .select('*, category:expense_categories(name)')
      .eq('business_id', businessId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    // Any hacky cast for joining
    expenses = (data as any) || [];
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto h-screen flex flex-col">
      <header className="mb-4 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Expenses</h1>
          <p className="text-sm text-slate-500 font-medium">Track your outgoings</p>
        </div>
        <button className="bg-slate-900 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform">
          <Plus size={20} />
        </button>
      </header>

      <div className="space-y-3">
        {expenses.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-xl shadow-sm">
            <FileText className="mx-auto text-slate-300 mb-3" size={32} />
            <h3 className="text-slate-900 font-medium mb-1">No expenses yet</h3>
            <p className="text-sm text-slate-500">Record your daily expenses here.</p>
          </div>
        ) : (
          expenses.map(expense => (
            <div key={expense.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-900 text-base">{expense.category?.name || 'Uncategorized'}</h4>
                <div className="space-y-1 mt-1">
                  {expense.note && (
                    <p className="text-xs text-slate-500">{expense.note}</p>
                  )}
                  <p className="text-xs text-slate-400 flex items-center gap-1 font-medium mt-1">
                    <Calendar size={12} /> {new Date(expense.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-600">-৳{expense.amount}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
