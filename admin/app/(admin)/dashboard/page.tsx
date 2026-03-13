"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  dashboardMetrics,
  newUserRegistrations7Days,
  tradingVolume7Days,
} from "@/lib/admin/mock-data";

const chartLabels = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];

export default function Dashboard() {
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

  const maxTradingVolume = Math.max(...tradingVolume7Days);
  const maxRegistrations = Math.max(...newUserRegistrations7Days);

  return (
    <div className="space-y-8 overflow-x-hidden">
      <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold mt-2">{dashboardMetrics.totalUsers.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active Users (last 24h)</p>
          <p className="text-2xl font-bold mt-2">{dashboardMetrics.activeUsers24h.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Trades Today</p>
          <p className="text-2xl font-bold mt-2">{dashboardMetrics.totalTradesToday.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Open Support Tickets</p>
          <p className="text-2xl font-bold mt-2">{dashboardMetrics.openSupportTickets.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">System Status</p>
          <p className="text-lg font-semibold mt-2 text-green-600 dark:text-green-400">Operational</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold mb-4">Trading volume (7 days)</h2>
          <div className="grid grid-cols-7 gap-3 items-end h-56">
            {tradingVolume7Days.map((value, index) => (
              <div key={`trading-${index}`} className="flex flex-col items-center gap-2">
                <div
                  className="w-full bg-yellow-500 rounded-t"
                  style={{ height: `${Math.max((value / maxTradingVolume) * 180, 8)}px` }}
                />
                <span className="text-xs text-muted-foreground">{chartLabels[index]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold mb-4">New user registrations</h2>
          <div className="grid grid-cols-7 gap-3 items-end h-56">
            {newUserRegistrations7Days.map((value, index) => (
              <div key={`users-${index}`} className="flex flex-col items-center gap-2">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${Math.max((value / maxRegistrations) * 180, 8)}px` }}
                />
                <span className="text-xs text-muted-foreground">{chartLabels[index]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

