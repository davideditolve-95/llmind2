'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DatastoresRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/vectorstores');
  }, [router]);

  return (
    <div className="app-page flex justify-center py-20">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
}
