'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()}
      className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 active:bg-primary-700 transition-colors"
    >
      <Printer size={18} />
      Print
    </button>
  );
}
