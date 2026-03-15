"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchStrategies } from "@/app/api/strategyApi";
import { Strategy } from "@/components/marketplace/types";
import { useAuth } from "@/components/auth/auth-provider";
import { getToken } from "@/lib/auth";

const MARKETPLACE_API_BASE =
  process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8790";

export default function MarketplacePaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const strategyId = searchParams.get("strategyId");

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  useEffect(() => {
    async function loadStrategy() {
      try {
        setLoading(true);
        setError("");

        if (!strategyId) {
          setError("Missing strategyId.");
          setStrategy(null);
          return;
        }

        const strategies = await fetchStrategies();

        const found = strategies.find(
          (item) =>
            String(item.strategyId ?? item.id) === String(strategyId)
        );

        if (!found) {
          setError("Strategy not found.");
          setStrategy(null);
          return;
        }

        setStrategy(found);
      } catch (err: any) {
        console.error("Failed to load strategy:", err);
        setError(err?.message || "Failed to load strategy.");
        setStrategy(null);
      } finally {
        setLoading(false);
      }
    }

    loadStrategy();
  }, [strategyId]);

  const displayPrice = useMemo(() => {
    if (!strategy) return "";
    return strategy.price === "free" ? "Free" : `$${strategy.price}`;
  }, [strategy]);

  const handleCheckout = async () => {
    if (!strategy || !user) return;

    if (strategy.price === "free") {
      try {
        const buyResponse = await fetch(
          `${MARKETPLACE_API_BASE}/marketplace/strategies/${encodeURIComponent(
            String(strategy.strategyId ?? strategy.id)
          )}/buy`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              userId: Number(user.id),
            }),
          }
        );

        if (!buyResponse.ok) {
          const errorData = await buyResponse.json().catch(() => null);
          throw new Error(errorData?.message || "Failed to save free strategy");
        }

        router.push("/strategy");
      } catch (err: any) {
        console.error("Free strategy save error:", err);
        setError(err?.message || "Unable to save free strategy.");
      }

      return;
    }

    try {
      setPaying(true);
      setError("");

      const buyResponse = await fetch(
        `${MARKETPLACE_API_BASE}/marketplace/strategies/${encodeURIComponent(
          String(strategy.strategyId ?? strategy.id)
        )}/buy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            userId: Number(user.id),
          }),
        }
      );

      if (!buyResponse.ok) {
        const errorData = await buyResponse.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to save purchase");
      }

      const response = await fetch(
        `${MARKETPLACE_API_BASE}/marketplace/payments/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            strategyId: strategy.strategyId ?? strategy.id,
            userId: Number(user.id),
            email: user.email,
            successUrl: `${window.location.origin}/marketplace/payment/success?strategyId=${encodeURIComponent(
              String(strategy.strategyId ?? strategy.id)
            )}`,
            cancelUrl: `${window.location.origin}/marketplace/payment?strategyId=${encodeURIComponent(
              String(strategy.strategyId ?? strategy.id)
            )}`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `Failed to create checkout session: ${response.status}`
        );
      }

      const data = await response.json();

      if (!data?.checkoutUrl) {
        throw new Error("Missing checkout URL from backend.");
      }

      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      console.error("Stripe checkout error:", err);
      setError(err?.message || "Unable to start payment.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 p-6 space-y-6">
          <Button
            variant="outline"
            onClick={() => router.push("/marketplace")}
            className="w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>

          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
            <h2 className="font-semibold">Unable to open payment page</h2>
            <p className="text-sm mt-1">{error || "Unknown error"}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-6 pt-6 space-y-6 max-w-4xl mx-auto w-full">
        <Button
          variant="outline"
          onClick={() => router.push("/marketplace")}
          className="w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Button>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
          <p className="text-muted-foreground mt-2">
            Review your strategy purchase and continue to secure payment.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-semibold">Strategy Details</h2>

            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{strategy.name}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="font-medium">{strategy.description}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Creator</p>
              <p className="font-medium">{strategy.creatorName || strategy.creator}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Risk</p>
              <p className="font-medium capitalize">{strategy.riskLevel}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="text-2xl font-bold">{displayPrice}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-semibold">Payment Summary</h2>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Strategy</span>
              <span className="font-medium">{strategy.name}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{displayPrice}</span>
            </div>

            <div className="border-t pt-4 flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">{displayPrice}</span>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              onClick={handleCheckout}
              disabled={paying}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting to Stripe...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay with Stripe
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}