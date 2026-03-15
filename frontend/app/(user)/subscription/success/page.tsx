// src/frontend/app/subscription/success/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { activateSubscription } from '@/lib/api/subscription-api';
import { SearchParamsWrapper } from '@/components/hooks/use-search-params';

function SubscriptionSuccessContent({ searchParams }: { searchParams: URLSearchParams }) {
  const sessionId = searchParams.get('session_id');
  const [activating, setActivating] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) { setActivating(false); return; }
    activateSubscription(sessionId)
      .then(() => setActivating(false))
      .catch((err) => { setError(err.message ?? 'Activation failed'); setActivating(false); });
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        {activating ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
            <p className="text-muted-foreground">Activating your subscription…</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-red-500">{error}</p>
            <Link href="/subscription" className="text-yellow-500 underline text-sm">Back to Subscription</Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Subscription Activated!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You now have access to all Pro features — unlimited imports, purchases, and publish requests.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/strategy"
                className="w-full flex justify-center py-3 px-4 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-sm transition-colors"
              >
                Go to My Strategies
              </Link>
              <Link
                href="/marketplace"
                className="w-full flex justify-center py-3 px-4 rounded-xl border border-border text-sm hover:bg-muted transition-colors"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <SearchParamsWrapper fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-yellow-500" /></div>}>
      {(searchParams) => <SubscriptionSuccessContent searchParams={searchParams} />}
    </SearchParamsWrapper>
  );
}

