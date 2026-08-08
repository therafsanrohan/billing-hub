'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface NotificationModalProps {
  isOpen: boolean;
  type?: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}

export default function NotificationModal({
  isOpen,
  type = 'info',
  title,
  message,
  onClose
}: NotificationModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-7 w-7 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="h-7 w-7 text-[#100e09]" />;
      case 'info':
      default:
        return <Info className="h-7 w-7 text-blue-600" />;
    }
  };

  const getBadgeBg = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-100';
      case 'error':
        return 'bg-red-50 border-red-100';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-[#f5f4eb] p-6 shadow-2xl border border-gray-100 transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start space-x-4">
          <div className={`p-2.5 rounded-xl border ${getBadgeBg()}`}>
            {getIcon()}
          </div>

          <div className="flex-1 pt-0.5">
            <h3 className="text-base font-extrabold text-[#1E1E1E] tracking-tight">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{message}</p>
          </div>
        </div>

        {/* Action button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            type="button"
            className={`w-full py-2.5 px-4 text-xs font-bold rounded-xl text-[#f5f4eb] shadow-sm transition ${
              type === 'error'
                ? 'bg-[#100e09] hover:bg-[#100e09]/90'
                : type === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            Okay, Understood
          </button>
        </div>
      </div>
    </div>
  );
}
