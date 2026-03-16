"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Strategy, tradingStrategyAPI } from "@/lib/api/trading-strategy-api";

export default function MarketPage() {
  const [mounted, setMounted] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    setLoading(true);
    tradingStrategyAPI.getAllUserMarketplaceStrategies()
      .then(setStrategies)
      .catch(() => setError("Failed to load marketplace strategies."))
      .finally(() => setLoading(false));
  }, [mounted, isAuthenticated]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">User Marketplace Strategies</h1>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <section className="rounded-lg border border-border bg-card p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : strategies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No user-submitted marketplace strategies found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Title</th>
                  <th className="text-left px-4 py-3 font-semibold">Description</th>
                  <th className="text-left px-4 py-3 font-semibold">User</th>
                  <th className="text-left px-4 py-3 font-semibold">Price</th>
                  <th className="text-left px-4 py-3 font-semibold">Purchases</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s) => (
                  <tr key={s.strategy_id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{s.description || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.author_email || "-"}</td>
                    <td className="px-4 py-3">${Number(s.price).toFixed(2)}</td>
                    <td className="px-4 py-3">{s.total_purchases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
