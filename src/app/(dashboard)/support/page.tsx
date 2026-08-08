import Link from 'next/link';
import { ArrowLeft, Mail, Phone, Globe, MessageCircle } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="p-4 md:p-8 w-full max-w-2xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/more" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Help & Support</h1>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-8 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">We're here to help</h2>
          <p className="text-slate-500 text-sm">
            Have an issue or a question? Reach out to our support team and we'll get back to you as soon as possible.
          </p>
        </div>
        
        <div className="p-4 space-y-4">
          <a href="mailto:support@corevow.com" className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Email Support</h3>
              <p className="text-sm text-slate-500">support@corevow.com</p>
            </div>
          </a>
          
          <a href="tel:+8801234567890" className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center shrink-0">
              <Phone size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Phone Support</h3>
              <p className="text-sm text-slate-500">+880 1234 567 890</p>
            </div>
          </a>

          <a href="https://corevow.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center shrink-0">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Website</h3>
              <p className="text-sm text-slate-500">www.corevow.com</p>
            </div>
          </a>
        </div>
      </div>
      
      <div className="text-center text-sm text-slate-400">
        <p>Corevow Billing v1.0.0</p>
      </div>
    </div>
  );
}
