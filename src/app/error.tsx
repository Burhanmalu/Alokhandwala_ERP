'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application Error:', error);
  }, [error]);

  return (
    <div className="h-full min-h-full w-full overflow-y-auto bg-[#0e1c14] text-slate-100 flex items-center justify-center p-4">
      <div className="bg-[#14281c] border border-rose-900/40 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-700/50 flex items-center justify-center mx-auto text-rose-400 mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-300 mb-6">
          {error.message || 'An unexpected operational error occurred.'}
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Try again</span>
        </button>
      </div>
    </div>
  );
}
