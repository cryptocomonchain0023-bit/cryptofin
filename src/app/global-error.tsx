'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Fatal global error caught by global-error boundary:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#050505] text-white min-h-screen flex items-center justify-center p-6 m-0 font-sans">
        <div className="max-w-md w-full bg-[#111111] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto mb-4 flex items-center justify-center font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold mb-2">Application Error</h2>
          <p className="text-zinc-400 text-sm mb-6">
            A temporary issue prevented this page from displaying correctly.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="bg-[#D4FF00] hover:bg-[#c8f200] text-black font-bold py-2.5 px-6 rounded-lg text-sm cursor-pointer"
            >
              Reload
            </button>
            <Link
              href="/"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-6 rounded-lg text-sm"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
