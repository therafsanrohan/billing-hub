'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Printer, Wifi, Bluetooth } from 'lucide-react';
import { toast } from 'sonner';

export default function PrintersPage() {
  const [printerType, setPrinterType] = useState('network');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('9100');
  const [paperSize, setPaperSize] = useState('80mm');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load from local storage
    const savedType = localStorage.getItem('printer_type');
    if (savedType) setPrinterType(savedType);
    
    const savedIp = localStorage.getItem('printer_ip');
    if (savedIp) setIpAddress(savedIp);
    
    const savedPort = localStorage.getItem('printer_port');
    if (savedPort) setPort(savedPort);
    
    const savedSize = localStorage.getItem('printer_paper_size');
    if (savedSize) setPaperSize(savedSize);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('printer_type', printerType);
    localStorage.setItem('printer_paper_size', paperSize);
    
    if (printerType === 'network') {
      localStorage.setItem('printer_ip', ipAddress);
      localStorage.setItem('printer_port', port);
    }
    
    toast.success('Printer configuration saved to this device');
  };

  const handleTestPrint = () => {
    toast.info('Sending test print...');
    // In a real implementation, you would send ESC/POS commands to the network printer via a backend proxy,
    // or use Web Bluetooth for local printing.
    setTimeout(() => {
      toast.success('Test print successful (Simulated)');
    }, 1500);
  };

  if (!isClient) return null;

  return (
    <div className="p-4 md:p-8 w-full max-w-3xl mx-auto pb-24 md:pb-8">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-slate-500 p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Printers</h1>
        </div>
      </header>

      <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-6 text-sm">
        <p><strong>Note:</strong> Printer settings are saved locally on this device. If you use POS on multiple devices, you will need to configure the printer on each device.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Connection Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPrinterType('network')}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-colors ${
                  printerType === 'network' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Wifi size={24} />
                <span className="font-bold">Network / Wi-Fi</span>
              </button>
              <button
                type="button"
                onClick={() => setPrinterType('bluetooth')}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-colors ${
                  printerType === 'bluetooth' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bluetooth size={24} />
                <span className="font-bold">Bluetooth (Web)</span>
              </button>
            </div>
          </div>

          {printerType === 'network' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Printer IP Address *</label>
                <input 
                  required
                  type="text" 
                  placeholder="192.168.1.100"
                  value={ipAddress}
                  onChange={e => setIpAddress(e.target.value)}
                  className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Port</label>
                <input 
                  required
                  type="text" 
                  value={port}
                  onChange={e => setPort(e.target.value)}
                  className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {printerType === 'bluetooth' && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-600 mb-4">
                Bluetooth printing uses the Web Bluetooth API. It only works on Chrome/Edge on Desktop and Android. It is <strong>not supported on iOS Safari</strong>.
              </p>
              <button 
                type="button"
                className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm w-full"
              >
                Pair Bluetooth Printer
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Paper Size</label>
            <select 
              value={paperSize}
              onChange={e => setPaperSize(e.target.value)}
              className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="80mm">80mm (Standard POS)</option>
              <option value="58mm">58mm (Small POS)</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button 
            type="button"
            onClick={handleTestPrint}
            className="w-1/3 h-14 bg-slate-100 text-slate-700 font-bold rounded-xl active:scale-[0.98] transition-transform"
          >
            Test Print
          </button>
          <button 
            type="submit"
            className="w-2/3 h-14 bg-primary-600 text-white font-bold rounded-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Save size={20} />
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
