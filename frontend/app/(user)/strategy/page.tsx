"use client";

import { useState, useEffect } from "react";
import { Plus, ShoppingCart, User, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchMyStrategies, MyStrategySummary } from "@/lib/api/myStrategies";
import { fetchBoughtStrategies } from "@/app/api/strategyApi";
import { Strategy as BoughtStrategy } from "@/components/marketplace/types";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export default function Strategy() {
  const { user, isLoading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [myStrategies, setMyStrategies] = useState<MyStrategySummary[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);

  const [boughtStrategies, setBoughtStrategies] = useState<BoughtStrategy[]>([]);
  const [loadingBought, setLoadingBought] = useState(true);
  const [boughtError, setBoughtError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateStrategy = () => {
    router.push("/strategy-hub");
  };

  useEffect(() => {
    if (!mounted) return;

    setLoadingStrategies(true);
    fetchMyStrategies()
      .then((data) => {
        setMyStrategies(data);
        setStrategiesError(null);
      })
      .catch((err) => {
        console.error("Failed to load strategies", err);
        setStrategiesError(err.message ?? "Failed to load strategies");
      })
      .finally(() => setLoadingStrategies(false));
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !user) return;

    setLoadingBought(true);
    fetchBoughtStrategies(Number(user.id))
      .then((strategies) => {
        setBoughtStrategies(strategies);
        setBoughtError(null);
      })
      .catch((err) => {
        console.error("Failed to load purchased strategies", err);
        setBoughtError(err.message ?? "Failed to load purchased strategies");
      })
      .finally(() => setLoadingBought(false));
  }, [mounted, user]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Strategy Hub</h1>
            <p className="text-muted-foreground mt-1">
              Manage your created and purchased strategies
            </p>
          </div>

          <Button
            onClick={handleCreateStrategy}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Strategy
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                  <User className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">My Created Strategies</h2>
                  <p className="text-sm text-muted-foreground">
                    Strategies you built and manage
                  </p>
                </div>
              </div>

              <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {myStrategies.length}
              </div>
            </div>

            <div className="p-6">
              {loadingStrategies ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading strategies...
                </div>
              ) : strategiesError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {strategiesError}
                </div>
              ) : myStrategies.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t created any strategies yet.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {myStrategies.map((strategy) => (
                    <div
                      key={strategy.workflow_uuid}
                      className="group rounded-2xl border bg-background p-4 transition-all hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="mt-1 h-3 w-3 rounded-full bg-green-500" />
                          <div>
                            <h3 className="font-semibold">{strategy.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {strategy.code_metrics.lines} lines • {strategy.compiler_version}
                            </p>
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                  <ShoppingCart className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Bought Strategies</h2>
                  <p className="text-sm text-muted-foreground">
                    Strategies you purchased from the marketplace
                  </p>
                </div>
              </div>

              <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {boughtStrategies.length}
              </div>
            </div>

            <div className="p-6">
              {authLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading user...
                </div>
              ) : !user ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Please log in to view purchased strategies.
                  </p>
                </div>
              ) : loadingBought ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading purchases...
                </div>
              ) : boughtError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {boughtError}
                </div>
              ) : boughtStrategies.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t purchased any strategies yet.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {boughtStrategies.map((strategy) => {
                    const price =
                      strategy.price === "free" ? "Free" : `$${strategy.price}`;

                    return (
                      <div
                        key={String(strategy.strategyId ?? strategy.id)}
                        className="group rounded-2xl border bg-background p-4 transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="mt-1 h-3 w-3 rounded-full bg-purple-500" />
                            <div className="space-y-1">
                              <h3 className="font-semibold">{strategy.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {strategy.category} • {strategy.type}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {price} • Subscribers: {strategy.subscriberCount}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600">
                              Purchased
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}