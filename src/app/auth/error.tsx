'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Auth route error caught by boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FBF9F1] text-[#111111] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[24px] p-8 shadow-sm flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-5">
          <AlertCircle size={28} />
        </div>

        <h1 className="text-2xl font-black text-[#111111] tracking-tight mb-2">
          Authentication Notice
        </h1>
        <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">
          We encountered an issue loading this step. Your session is safe, please try again or return to login.
        </p>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => reset()}
            className="w-full bg-[#D4FF00] hover:bg-[#c8f200] text-[#111111] font-black text-sm py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.98]"
          >
            <RotateCcw size={16} />
            Try Again
          </button>
          <Link
            href="/auth/login"
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm py-3.5 rounded-full transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
