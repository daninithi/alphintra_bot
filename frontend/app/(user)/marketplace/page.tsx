"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui";
import { Loader2 } from "lucide-react";
import { fetchStrategies } from "@/app/api/strategyApi";
import StrategyGrid from "@/components/marketplace/StrategyGrid";
import { Strategy } from "@/components/marketplace/types";

type FilterType = "all" | "default" | "marketplace";

export default function MarketplacePage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  useEffect(() => {
    async function loadStrategies() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchStrategies();
        setStrategies(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Failed to load marketplace strategies:", err);
        setError(err?.message || "Failed to load marketplace strategies");
      } finally {
        setLoading(false);
      }
    }

    loadStrategies();
  }, []);

  const filteredStrategies = useMemo(() => {
    let data = [...strategies];

    if (selectedFilter !== "all") {
      data = data.filter((strategy) => strategy.type === selectedFilter);
    }

    const query = search.trim().toLowerCase();

    if (query) {
      data = data.filter((strategy) => {
        const name = strategy.name?.toLowerCase() || "";
        const description = strategy.description?.toLowerCase() || "";
        const creator = strategy.creator?.toLowerCase() || "";
        const category = strategy.category?.toLowerCase() || "";
        const type = strategy.type?.toLowerCase() || "";

        return (
          name.includes(query) ||
          description.includes(query) ||
          creator.includes(query) ||
          category.includes(query) ||
          type.includes(query)
        );
      });
    }

    return data;
  }, [strategies, selectedFilter, search]);

  const totalStrategies = strategies.length;
  const freeStrategies = strategies.filter((s) => s.price === "free").length;
  const paidStrategies = strategies.filter((s) => s.price !== "free").length;

  const handleBuyNow = (strategy: Strategy) => {
    const strategyId = strategy.strategyId || strategy.id;

    if (!strategyId) {
      console.error("Missing strategyId on strategy:", strategy);
      setError("Unable to open payment page: missing strategy id.");
      return;
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
        <div className="pt-6 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground max-w-2xl">
            Browse built-in and premium trading strategies. Compare options,
            explore details, and choose strategies that match your style.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
            <p className="text-sm text-muted-foreground">Total Strategies</p>
            <p className="mt-2 text-3xl font-semibold">{totalStrategies}</p>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
            <p className="text-sm text-muted-foreground">Free Strategies</p>
            <p className="mt-2 text-3xl font-semibold">{freeStrategies}</p>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
            <p className="text-sm text-muted-foreground">Premium Strategies</p>
            <p className="mt-2 text-3xl font-semibold">{paidStrategies}</p>
          </div>
        </div>

        <div className="p-4 flex justify-between items-center gap-4 flex-wrap rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedFilter === "all" ? "default" : "outline"}
              className={
                selectedFilter === "all"
                  ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                  : ""
              }
              onClick={() => setSelectedFilter("all")}
            >
              All
            </Button>

            <Button
              variant={selectedFilter === "default" ? "default" : "outline"}
              className={
                selectedFilter === "default"
                  ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                  : ""
              }
              onClick={() => setSelectedFilter("default")}
            >
              Default
            </Button>

            <Button
              variant={selectedFilter === "marketplace" ? "default" : "outline"}
              className={
                selectedFilter === "marketplace"
                  ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                  : ""
              }
              onClick={() => setSelectedFilter("marketplace")}
            >
              Marketplace
            </Button>
          </div>

          <Input
            placeholder="Search strategies..."
            className="w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
            <h2 className="font-semibold">Failed to load marketplace</h2>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {!error && filteredStrategies.length === 0 && (
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-10 text-center">
            <p className="text-lg font-medium">No strategies found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try changing your search or filter.
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

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Creator</p>
                <p className="mt-1 font-medium">{selectedStrategy.creator}</p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="mt-1 font-medium">{selectedStrategy.category}</p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Risk</p>
                <p className="mt-1 font-medium capitalize">{selectedStrategy.riskLevel}</p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="mt-1 font-medium">
                  {selectedStrategy.price === "free"
                    ? "Free"
                    : `$${selectedStrategy.price}`}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={() => handleBuyNow(selectedStrategy)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                {selectedStrategy.price === "free" ? "Get Now" : "Buy Now"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}