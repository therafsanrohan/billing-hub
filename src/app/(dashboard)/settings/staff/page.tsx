'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, UserPlus, MapPin, Building, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function StaffAndBranchesPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const supabase = createClient();
      const { data: member } = await supabase.from('business_members').select('business_id').limit(1).single();
      
      if (member?.business_id) {
        setBusinessId(member.business_id);
        
        const [membersRes, locationsRes] = await Promise.all([
          supabase.from('business_members').select('*, profiles(email)').eq('business_id', member.business_id),
          supabase.from('inventory_locations').select('*').eq('business_id', member.business_id)
        ]);
        
        if (membersRes.data) setMembers(membersRes.data);
        if (locationsRes.data) setLocations(locationsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto pb-24 md:pb-8 space-y-8">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff & Branches</h1>
        </div>
      </header>

      {/* Staff Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Staff Members</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm">
            <UserPlus size={16} />
            Invite Staff
          </button>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {members.map((m, i) => (
            <div key={m.id} className={`p-4 flex items-center justify-between ${i !== members.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                  {m.profiles?.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{m.profiles?.email || 'Unknown User'}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <Shield size={12} />
                    {m.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">No staff found.</div>
          )}
        </div>
      </section>

      {/* Branches Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Branches (Locations)</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm">
            <Building size={16} />
            Add Branch
          </button>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {locations.map((loc, i) => (
            <div key={loc.id} className={`p-4 flex items-center justify-between ${i !== locations.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {loc.name}
                    {loc.is_default && <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded uppercase font-bold tracking-wider">Default</span>}
                  </h3>
                  {loc.address && <p className="text-xs text-slate-500 mt-1">{loc.address}</p>}
                </div>
              </div>
            </div>
          ))}
          {locations.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">No locations found.</div>
          )}
        </div>
      </section>
    </div>
  );
}
