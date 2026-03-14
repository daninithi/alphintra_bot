"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export default function MarketplacePaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const strategyId = searchParams.get("strategyId");

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.push("/marketplace");
    }, 2500);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-8 max-w-md w-full text-center">
        <CheckCircle2 className="w-14 h-14 mx-auto text-green-600 mb-4" />
        <h1 className="text-2xl font-bold">Payment Successful</h1>
        <p className="text-muted-foreground mt-2">
          Your strategy purchase was completed successfully.
        </p>
        {strategyId && (
          <p className="text-sm text-muted-foreground mt-2">
            Strategy: {strategyId}
          </p>
        )}
        <p className="text-sm mt-4">Redirecting to marketplace...</p>
      </div>
    </div>
  );
}