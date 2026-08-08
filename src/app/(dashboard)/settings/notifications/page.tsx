'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    low_stock_alerts: true,
    daily_reports: false,
  });

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('preferences').eq('id', user.id).single();
        if (profile?.preferences) {
          setPreferences({
            low_stock_alerts: profile.preferences.low_stock_alerts ?? true,
            daily_reports: profile.preferences.daily_reports ?? false,
          });
        }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setSaving(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('profiles')
      .update({
        preferences: preferences,
      })
      .eq('id', userId);
      
    setSaving(false);
    
    if (error) {
      toast.error('Failed to update notification preferences');
      console.error(error);
    } else {
      toast.success('Notification preferences updated');
      router.refresh();
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-4 md:p-8 w-full max-w-2xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Low Stock Alerts</h3>
              <p className="text-xs text-slate-500 mt-1">Get notified when products drop below their minimum stock level.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={preferences.low_stock_alerts}
                onChange={e => setPreferences({...preferences, low_stock_alerts: e.target.checked})}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Daily End-of-Day Reports</h3>
              <p className="text-xs text-slate-500 mt-1">Receive an email summary of all sales and expenses at the end of the day.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={preferences.daily_reports}
                onChange={e => setPreferences({...preferences, daily_reports: e.target.checked})}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

        </div>
        
        <button 
          type="submit"
          disabled={saving}
          className="w-full h-14 bg-primary-600 text-white font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 mt-8"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </form>
    </div>
  );
}
