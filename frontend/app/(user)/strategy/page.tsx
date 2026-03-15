"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, Loader2, ShoppingCart, ChevronRight, CheckCircle2, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchBoughtStrategies } from "@/app/api/strategyApi";
import { Strategy as BoughtStrategy } from "@/components/marketplace/types";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { getUserImportedStrategies, UserStrategy } from "@/lib/api/user-strategy-api";
import UserStrategyImportModal from "@/components/strategies/UserStrategyImportModal";
import UserImportedStrategies from "@/components/strategies/UserImportedStrategies";
import UpgradeModal from "@/components/subscription/UpgradeModal";
import { getSubscriptionStatus } from "@/lib/api/subscription-api";

export default function Strategy() {
  const { user, isLoading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [boughtStrategies, setBoughtStrategies] = useState<BoughtStrategy[]>([]);
  const [loadingBought, setLoadingBought] = useState(true);
  const [boughtError, setBoughtError] = useState<string | null>(null);

  const [importedStrategies, setImportedStrategies] = useState<UserStrategy[]>([]);
  const [loadingImported, setLoadingImported] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"import" | "purchase" | "publish" | null>(null);

  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    setLoadingBought(true);
    fetchBoughtStrategies(Number(user.id))
      .then((strategies) => { setBoughtStrategies(strategies); setBoughtError(null); })
      .catch((err) => { setBoughtError(err.message ?? "Failed to load purchased strategies"); })
      .finally(() => setLoadingBought(false));
  }, [mounted, user]);

  const loadImported = useCallback(() => {
    setLoadingImported(true);
    getUserImportedStrategies()
      .then(setImportedStrategies)
      .catch(() => setImportedStrategies([]))
      .finally(() => setLoadingImported(false));
  }, []);

  useEffect(() => { if (mounted) loadImported(); }, [mounted, loadImported]);

  const handleImportClick = async () => {
    const FREE_LIMIT = 2;
    const status = await getSubscriptionStatus(Number(user?.id));
    if (!status.isSubscribed && importedStrategies.length >= FREE_LIMIT) {
      setUpgradeReason("import");
    } else {
      setShowImportModal(true);
    }
  };

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

          <div className="flex items-center gap-3">
            <Button
              onClick={handleImportClick}
              variant="outline"
              className="border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Strategy
            </Button>

            {/* <Button
              onClick={handleCreateStrategy}
              className="bg-yellow-500 hover:bg-yellow-600 tex              lsof -i :8790 | grep LISTENt-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Strategy
            </Button> */}
          </div>
        </div>



        <div className="grid gap-6 xl:grid-cols-2">
          {/* <section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
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
          </section> */}

        {/* ── Imported Strategies (py file import) ── */}
        <section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between border-b px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">
                <Upload className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">My Imported Strategies</h2>
                <p className="text-sm text-muted-foreground">
                  Strategies you imported from Python files
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {importedStrategies.length}
              </div>
  
            </div>
          </div>
          <div className="p-6">
            {loadingImported ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading imported strategies...
              </div>
            ) : (
              <UserImportedStrategies
                strategies={importedStrategies}
                onRefresh={loadImported}
              />
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
              {authLoading || loadingBought ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading purchases...
                </div>
              ) : boughtError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {boughtError}
                </div>
              ) : boughtStrategies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t purchased any strategies yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {boughtStrategies.map((strategy) => {
                    const price =
                      strategy.price === "free" ? "Free" : `$${strategy.price}`;

                    return (
                      <div
                        key={String(strategy.strategyId ?? strategy.id)}
                        className="rounded-xl border border-border bg-card p-4 hover:border-green-500/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                              <ShoppingCart className="w-4 h-4 text-green-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{strategy.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {strategy.category} • {strategy.type}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {price} • Subscribers: {strategy.subscriberCount}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                            Purchased
                          </span>
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

      {showImportModal && (
        <UserStrategyImportModal
          onSuccess={loadImported}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {upgradeReason && (
        <UpgradeModal
          reason={upgradeReason}
          onClose={() => setUpgradeReason(null)}
        />
      )}
    </div>
  );
}

