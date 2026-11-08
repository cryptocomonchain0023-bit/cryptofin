'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error caught by boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6">
          <AlertCircle size={32} />
        </div>

        <h1 className="text-2xl font-black tracking-tight mb-2">Something went wrong</h1>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          An unexpected client error occurred while loading this page. You can try reloading or return to safety.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => reset()}
            className="flex-1 bg-[#D4FF00] hover:bg-[#c8f200] text-black font-extrabold py-3.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-sm"
          >
            <RotateCcw size={16} />
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 bg-white/10 hover:bg-white/15 text-white font-bold py-3.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Home size={16} />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
