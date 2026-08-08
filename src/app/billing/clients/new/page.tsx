'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, BillingClient, Profile } from '@/lib/db';
import { ArrowLeft, UserPlus, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export default function NewClientPage() {
  const router = useRouter();
  
  const [clientType, setClientType] = useState<'company' | 'individual'>('company');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [additionalEmailsStr, setAdditionalEmailsStr] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState<'BDT' | 'USD'>('USD');
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState<BillingClient['default_payment_terms']>('30 Days');
  const [accountManagerId, setAccountManagerId] = useState('');
  const [internalNote, setInternalNote] = useState('');
  
  const [managers, setManagers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadManagers() {
      const profiles = await db.getProfiles();
      const clientServiceAndAdmins = profiles.filter(
        p => p.role_name === 'Super Admin' || p.role_name === 'Client Service' || p.role_name === 'Finance Admin'
      );
      setManagers(clientServiceAndAdmins);
      if (clientServiceAndAdmins.length > 0) {
        setAccountManagerId(clientServiceAndAdmins[0].id);
      }
    }
    loadManagers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Custom Validation
    if (clientType === 'company' && !companyName.trim()) {
      setError('Company name is required for corporate clients.');
      setLoading(false);
      return;
    }

    try {
      const additionalEmails = additionalEmailsStr
        .split(',')
        .map(em => em.trim())
        .filter(em => em.length > 0);

      await db.createClient({
        client_type: clientType,
        company_name: clientType === 'company' ? companyName.trim() : '',
        contact_person: contactPerson.trim(),
        billing_email: billingEmail.trim().toLowerCase(),
        additional_emails: additionalEmails,
        phone: phone.trim(),
        billing_address: billingAddress.trim(),
        city: city.trim(),
        country: country.trim(),
        tax_number: taxNumber.trim(),
        preferred_currency: preferredCurrency,
        default_payment_terms: defaultPaymentTerms,
        account_manager_id: accountManagerId,
        internal_note: internalNote.trim()
      });

      router.push('/billing/clients');
    } catch (err: any) {
      setError(err.message || 'Failed to create client.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Back button */}
      <div>
        <Link href="/billing/clients" className="inline-flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Clients Directory</span>
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Create Client Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Register billing contact coordinates and transaction settings</p>
      </div>

      {/* Form Card */}
      <div className="bg-[#f5f4eb] border border-gray-100 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-[#100e09]">
              {error}
            </div>
          )}

          {/* Section 1: Client Type */}
          <div className="space-y-3">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Account Particulars</span>
            
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition ${
                clientType === 'company' 
                  ? 'border-[#100e09] bg-[#100e09]/5 text-[#100e09]' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="client_type"
                  checked={clientType === 'company'}
                  onChange={() => setClientType('company')}
                  className="sr-only"
                />
                <span className="font-bold text-sm">Corporate Client</span>
                <span className="text-[10px] text-gray-450 mt-1">Company or corporate legal entity</span>
              </label>

              <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition ${
                clientType === 'individual' 
                  ? 'border-[#100e09] bg-[#100e09]/5 text-[#100e09]' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="client_type"
                  checked={clientType === 'individual'}
                  onChange={() => setClientType('individual')}
                  className="sr-only"
                />
                <span className="font-bold text-sm">Individual Client</span>
                <span className="text-[10px] text-gray-450 mt-1">Sole trader, partner, or freelancer</span>
              </label>
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
            {clientType === 'company' && (
              <div className="md:col-span-2">
                <label htmlFor="company_name" className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-1">
                  Company Name <span className="text-[#100e09]">*</span>
                </label>
                <input
                  id="company_name"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                  placeholder="e.g. Acme Tech Solutions Ltd."
                />
              </div>
            )}

            <div>
              <label htmlFor="contact_person" className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-1">
                Primary Contact Person <span className="text-[#100e09]">*</span>
              </label>
              <input
                id="contact_person"
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                placeholder="e.g. Sarah Jenkins"
              />
            </div>

            <div>
              <label htmlFor="billing_email" className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-1">
                Billing Email Address <span className="text-[#100e09]">*</span>
              </label>
              <input
                id="billing_email"
                type="email"
                required
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                placeholder="accounting@company.com"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="additional_emails" className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-1">
                Additional CC Invoice Emails <span className="text-[10px] text-gray-400 font-normal font-sans">(Comma separated)</span>
              </label>
              <input
                id="additional_emails"
                type="text"
                value={additionalEmailsStr}
                onChange={(e) => setAdditionalEmailsStr(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                placeholder="cc1@company.com, cc2@company.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-1">
                Telephone Phone Number
              </label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                placeholder="+1 555-123-4567"
              />
            </div>

            <div>
              <label htmlFor="tax_number" className="block text-xs font-semibold uppercase tracking-wider text-gray-550 mb-1">
                Tax, VAT, or BIN Number
              </label>
              <input
                id="tax_number"
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                placeholder="TIN / VAT ID"
              />
            </div>
          </div>

          {/* Section 3: Billing Address */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-50">
            <div className="md:col-span-3">
              <label htmlFor="billing_address" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                Billing Street Address <span className="text-[#100e09]">*</span>
              </label>
              <textarea
                id="billing_address"
                required
                rows={3}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none resize-y"
                placeholder="Full address (including suite/building)"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                City <span className="text-[#100e09]">*</span>
              </label>
              <input
                id="city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                placeholder="Dhaka / Boston"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="country" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                Country <span className="text-[#100e09]">*</span>
              </label>
              <input
                id="country"
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none"
                placeholder="Bangladesh / United States"
              />
            </div>
          </div>

          {/* Section 4: Settings & Preferences */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-50">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Preferred Billing Currency</span>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="preferred_currency"
                    checked={preferredCurrency === 'USD'}
                    onChange={() => setPreferredCurrency('USD')}
                    className="accent-[#100e09]"
                  />
                  <span>USD ($)</span>
                </label>
                <label className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="preferred_currency"
                    checked={preferredCurrency === 'BDT'}
                    onChange={() => setPreferredCurrency('BDT')}
                    className="accent-[#100e09]"
                  />
                  <span>BDT (৳)</span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="payment_terms" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                Default Payment Terms
              </label>
              <select
                id="payment_terms"
                value={defaultPaymentTerms}
                onChange={(e) => setDefaultPaymentTerms(e.target.value as any)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
              >
                <option value="Due on Receipt">Due on Receipt</option>
                <option value="7 Days">7 Days</option>
                <option value="15 Days">15 Days</option>
                <option value="30 Days">30 Days</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div>
              <label htmlFor="account_manager" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1">
                Assigned Account Manager
              </label>
              <select
                id="account_manager"
                value={accountManagerId}
                onChange={(e) => setAccountManagerId(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none cursor-pointer"
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label htmlFor="internal_note" className="block text-xs font-semibold uppercase tracking-wider text-gray-555 mb-1 flex items-center space-x-1">
                <span>Internal Business Notes</span>
                <span className="text-[9px] font-bold text-[#100e09] bg-red-50 px-1.5 py-0.5 rounded uppercase">Confidential</span>
              </label>
              <textarea
                id="internal_note"
                rows={2}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-3 text-sm text-[#1E1E1E] focus:border-[#100e09] focus:outline-none resize-y"
                placeholder="This information is internal-only and will NEVER be rendered on client PDFs or invoices."
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-50">
            <Link
              href="/billing/clients"
              className="rounded-lg border border-gray-200 bg-[#f5f4eb] py-2.5 px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#100e09] py-2.5 px-6 text-xs font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save Client Profile'}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
