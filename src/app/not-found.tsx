'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="h-full min-h-full w-full overflow-y-auto bg-[#0e1c14] text-slate-100 flex items-center justify-center p-4">
      <div className="bg-[#14281c] border border-[#1e3b2e] rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-700/50 flex items-center justify-center mx-auto text-emerald-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Page Not Found</h2>
        <p className="text-sm text-slate-300 mb-6">
          The requested page or scaffolding resource could not be found.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
