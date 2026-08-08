'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function ReceiptSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    logo_url: '',
    receipt_header: '',
    receipt_footer: '',
    receipt_message: '',
  });

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: member } = await supabase.from('business_members').select('business_id').limit(1).single();
      
      if (member?.business_id) {
        setBusinessId(member.business_id);
        const { data: business } = await supabase.from('businesses').select('*').eq('id', member.business_id).single();
        if (business) {
          setFormData({
            logo_url: business.logo_url || '',
            receipt_header: business.receipt_header || '',
            receipt_footer: business.receipt_footer || 'Thank you for your business!',
            receipt_message: business.receipt_message || '',
          });
        }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    
    setSaving(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('businesses')
      .update({
        logo_url: formData.logo_url,
        receipt_header: formData.receipt_header,
        receipt_footer: formData.receipt_footer,
        receipt_message: formData.receipt_message,
      })
      .eq('id', businessId);
      
    setSaving(false);
    
    if (error) {
      toast.error('Failed to update receipt settings');
      console.error(error);
    } else {
      toast.success('Receipt settings updated');
      router.refresh();
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto pb-24 md:pb-8 flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <header className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Receipt Settings</h1>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Logo URL (Optional)</label>
              <input 
                type="url" 
                placeholder="https://example.com/logo.png"
                value={formData.logo_url}
                onChange={e => setFormData({...formData, logo_url: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Custom Header</label>
              <textarea 
                rows={2}
                placeholder="Printed below store name..."
                value={formData.receipt_header}
                onChange={e => setFormData({...formData, receipt_header: e.target.value})}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Custom Message</label>
              <textarea 
                rows={2}
                placeholder="e.g. Return policy: 7 days with receipt"
                value={formData.receipt_message}
                onChange={e => setFormData({...formData, receipt_message: e.target.value})}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Footer Text</label>
              <textarea 
                rows={2}
                value={formData.receipt_footer}
                onChange={e => setFormData({...formData, receipt_footer: e.target.value})}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={saving}
            className="w-full h-14 bg-primary-600 text-white font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* Receipt Preview */}
      <div className="w-full md:w-80 shrink-0">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Live Preview</h2>
        <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-sm font-mono text-xs text-center">
          {formData.logo_url && (
            <img src={formData.logo_url} alt="Logo" className="max-h-16 mx-auto mb-4 grayscale" />
          )}
          <h2 className="text-lg font-bold mb-1">STORE NAME</h2>
          {formData.receipt_header && <p className="mb-4 whitespace-pre-wrap">{formData.receipt_header}</p>}
          
          <div className="border-b border-dashed border-slate-300 my-4"></div>
          
          <div className="text-left space-y-1 mb-4">
            <div className="flex justify-between"><span>1x Item A</span><span>$10.00</span></div>
            <div className="flex justify-between"><span>2x Item B</span><span>$20.00</span></div>
          </div>
          
          <div className="border-b border-dashed border-slate-300 my-4"></div>
          
          <div className="text-left font-bold text-sm flex justify-between mb-4">
            <span>TOTAL</span>
            <span>$30.00</span>
          </div>

          {formData.receipt_message && (
            <div className="mb-4 whitespace-pre-wrap">{formData.receipt_message}</div>
          )}
          
          <p className="whitespace-pre-wrap">{formData.receipt_footer}</p>
        </div>
      </div>
    </div>
  );
}
