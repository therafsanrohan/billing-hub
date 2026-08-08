'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function StoreDetailsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    phone: '',
    email: '',
    address: '',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
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
            name: business.name || '',
            legal_name: business.legal_name || '',
            phone: business.phone || '',
            email: business.email || '',
            address: business.address || '',
            currency: business.currency || 'BDT',
            timezone: business.timezone || 'Asia/Dhaka',
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
        name: formData.name,
        legal_name: formData.legal_name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        currency: formData.currency,
        timezone: formData.timezone,
      })
      .eq('id', businessId);
      
    setSaving(false);
    
    if (error) {
      toast.error('Failed to update store details');
      console.error(error);
    } else {
      toast.success('Store details updated successfully');
      router.refresh();
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-4 md:p-8 w-full max-w-3xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Store Details</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Store Name *</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Legal Entity Name</label>
            <input 
              type="text" 
              value={formData.legal_name}
              onChange={e => setFormData({...formData, legal_name: e.target.value})}
              className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
              <input 
                type="text" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Address</label>
            <textarea 
              rows={3}
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Currency</label>
              <select 
                value={formData.currency}
                onChange={e => setFormData({...formData, currency: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="BDT">BDT (৳)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Timezone</label>
              <select 
                value={formData.timezone}
                onChange={e => setFormData({...formData, timezone: e.target.value})}
                className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Asia/Dhaka">Asia/Dhaka</option>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>
        
        <button 
          type="submit"
          disabled={saving}
          className="w-full h-14 bg-primary-600 text-white font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Details'}
        </button>
      </form>
    </div>
  );
}
