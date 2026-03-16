"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { fetchStrategies, fetchBoughtStrategies } from "@/app/api/strategyApi";
import StrategyGrid from "@/components/marketplace/StrategyGrid";
import { Strategy } from "@/components/marketplace/types";
import UpgradeModal from "@/components/subscription/UpgradeModal";
import { getSubscriptionStatus } from "@/lib/api/subscription-api";
import { useAuth } from "@/components/auth/auth-provider";

type SortType = "price-high" | "price-low" | "name-asc" | "name-desc";

export default function MarketplacePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("price-high");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    async function loadStrategies() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchStrategies(user?.id ? Number(user.id) : undefined);
        setStrategies(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Failed to load marketplace strategies:", err);
        setError(err?.message || "Failed to load marketplace strategies");
      } finally {
        setLoading(false);
      }
    }

    loadStrategies();
  }, [user?.id]);

  const filteredStrategies = useMemo(() => {
    let data = strategies.filter(
      (strategy) =>
        strategy.type === "marketplace" &&
        strategy.price !== "free" &&
        Number(strategy.price) > 0
    );

    const query = search.trim().toLowerCase();

    if (query) {
      data = data.filter((strategy) => {
        const searchableText = [
          strategy.name,
          strategy.description,
          strategy.creator,
          strategy.creatorName,
          strategy.category,
          strategy.type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    data.sort((a, b) => {
      if (sortBy === "price-high") {
        return Number(b.price) - Number(a.price);
      }

      if (sortBy === "price-low") {
        return Number(a.price) - Number(b.price);
      }

      if (sortBy === "name-asc") {
        return (a.name || "").localeCompare(b.name || "");
      }

      if (sortBy === "name-desc") {
        return (b.name || "").localeCompare(a.name || "");
      }

      return 0;
    });

    return data;
  }, [strategies, search, sortBy]);

  const visibleStrategiesCount = filteredStrategies.length;
  const premiumStrategiesCount = filteredStrategies.length;

  const handleBuyNow = async (strategy: Strategy) => {
    const strategyId = strategy.strategyId || strategy.id;

    if (!strategyId) {
      console.error("Missing strategyId on strategy:", strategy);
      setError("Unable to open payment page: missing strategy id.");
      return;
    }

    // Check purchase limit for free users
    const FREE_PURCHASE_LIMIT = 2;
    const status = await getSubscriptionStatus(Number(user?.id));
    if (!status.isSubscribed) {
      const bought = await fetchBoughtStrategies(Number(user?.id)).catch(() => []);
      if (bought.length >= FREE_PURCHASE_LIMIT) {
        setShowUpgrade(true);
        return;
      }
    }

    router.push(
      `/marketplace/payment?strategyId=${encodeURIComponent(String(strategyId))}`
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-6 pt-0 space-y-6">
        <div className="pt-6 space-y-4">
          <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 md:p-8">
            <div className="space-y-3">
              <p className="inline-flex rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                Alphintra Marketplace
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Premium Trading Strategies
              </h1>
            </div>
          </div>


        </div>

        <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by strategy name, creator, or description"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Sort by</span>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="h-10 min-w-[220px] rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:border-yellow-500"
              >
                <option value="price-high">Price: High to Low</option>
                <option value="price-low">Price: Low to High</option>
                <option value="name-asc">Alphabetical: A to Z</option>
                <option value="name-desc">Alphabetical: Z to A</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {search.trim() && (
              <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-yellow-700 dark:text-yellow-400">
                Search: {search}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
            <h2 className="font-semibold">Failed to load marketplace</h2>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {!error && filteredStrategies.length === 0 && (
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-10 text-center">
            <p className="text-lg font-medium">No marketplace strategies found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try changing your search or sorting.
            </p>
          </div>
        )}

        {!error && filteredStrategies.length > 0 && (
          <StrategyGrid
            filteredStrategies={filteredStrategies}
            viewMode="grid"
            onSelectStrategy={(strategy: Strategy) => setSelectedStrategy(strategy)}
            onBuyNow={handleBuyNow}
          />
        )}

        {selectedStrategy && (
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Selected Strategy
                </p>
                <h2 className="text-2xl font-semibold">{selectedStrategy.name}</h2>
                <p className="text-muted-foreground max-w-3xl">
                  {selectedStrategy.description}
                </p>
              </div>

              <Button variant="outline" onClick={() => setSelectedStrategy(null)}>
                Close
              </Button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Creator</p>
                <p className="mt-1 font-medium">
                  {selectedStrategy.creatorName || selectedStrategy.creator}
                </p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="mt-1 font-medium">{selectedStrategy.category}</p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="mt-1 font-medium">${selectedStrategy.price}</p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={() => handleBuyNow(selectedStrategy)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                Buy Now
              </Button>
            </div>
          </div>
        )}
      </main>

      {showUpgrade && (
        <UpgradeModal reason="purchase" onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}