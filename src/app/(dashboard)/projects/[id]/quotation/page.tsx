'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectDirectQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace(`/quotation?projectId=${id}`);
    }
  }, [id, router]);

  return (
    <div className="py-20 text-center">
      <div className="w-8 h-8 border-2 border-[#8c5e39] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <p className="text-xs font-semibold text-[#7d6553]">Opening Project Quotation...</p>
    </div>
  );
}
