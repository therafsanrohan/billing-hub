import Link from 'next/link';
import { Plus, FileText, ArrowLeft, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: member } = await supabase.from('business_members').select('business_id').limit(1).single();
  
  let expenses: any[] = [];
  if (member?.business_id) {
    const { data } = await supabase.from('expenses').select('*').eq('business_id', member.business_id).order('expense_date', { ascending: false });
    if (data) expenses = data;
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/more" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Expenses</h1>
        </div>
        <Link 
          href="/expenses/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Record Expense</span>
        </Link>
      </header>

      {expenses.length > 0 && (
        <div className="mb-6 bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-100 flex items-center justify-between">
          <span className="font-semibold">Total Expenses (All Time)</span>
          <span className="font-bold text-xl">${totalExpenses.toFixed(2)}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {expenses.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {expenses.map((expense) => (
              <div key={expense.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      {expense.category}
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded uppercase font-bold tracking-wider">
                        ${Number(expense.amount).toFixed(2)}
                      </span>
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(expense.expense_date).toLocaleDateString()}
                      </span>
                      {expense.description && (
                        <span>• {expense.description}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <FileText size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No expenses recorded</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm">Keep track of your business costs, rent, and utility bills here.</p>
            <Link 
              href="/expenses/new"
              className="bg-primary-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors"
            >
              Record First Expense
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
