"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { tradeHistory } from "@/lib/admin/mock-data";

export default function TradesPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Trading Management</h1>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Trade ID</th>
              <th className="text-left px-4 py-3 font-semibold">Buyer</th>
              <th className="text-left px-4 py-3 font-semibold">Seller</th>
              <th className="text-left px-4 py-3 font-semibold">Price</th>
              <th className="text-left px-4 py-3 font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {tradeHistory.map((trade) => (
              <tr key={trade.tradeId} className="border-t border-border">
                <td className="px-4 py-3">{trade.tradeId}</td>
                <td className="px-4 py-3">{trade.buyer}</td>
                <td className="px-4 py-3">{trade.seller}</td>
                <td className="px-4 py-3">${trade.price.toLocaleString()}</td>
                <td className="px-4 py-3">{new Date(trade.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
