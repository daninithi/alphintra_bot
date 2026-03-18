"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { authServiceApiClient } from "@/lib/api/auth-service-api";
import { tradingStrategyAPI } from "@/lib/api/trading-strategy-api";
import { Users, Zap, BarChart3, Ticket } from "lucide-react";
import MarketCryptoTable from "@/components/ui/dashboard/MarketCryptoTable";
import MarketNewsCard from "@/components/ui/dashboard/MarketNewsCard";
import AdminPriceChart from "@/components/ui/dashboard/AdminPriceChart";

interface MetricsData {
  totalUsers: number;
  totalStrategies: number;
  totalTickets: number;
  servicesUp: number;
}

export default function Dashboard() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [metrics, setMetrics] = useState<MetricsData>({
    totalUsers: 0,
    totalStrategies: 0,
    totalTickets: 0,
    servicesUp: 0,
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      loadMetrics();
    }
  }, [mounted, isAuthenticated]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [authMetrics, strategiesCount, systemHealth] = await Promise.all([
        authServiceApiClient.getMetrics(),
        tradingStrategyAPI.getStrategiesCount(),
        authServiceApiClient.getSystemHealth(),
      ]);

      setMetrics({
        totalUsers: authMetrics.totalUsers,
        totalStrategies: strategiesCount,
        totalTickets: 0, // Placeholder - will be updated when ticketing service endpoint is ready
        servicesUp: systemHealth.summary.up,
      });
    } catch (error) {
      console.error("Failed to load metrics:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const metricCards = [
    {
      icon: Users,
      label: "Total Users",
      value: metrics.totalUsers,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      icon: Zap,
      label: "Total Strategies",
      value: metrics.totalStrategies,
      color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
      borderColor: "border-yellow-200 dark:border-yellow-800",
    },
    {
      icon: Ticket,
      label: "Total Tickets",
      value: metrics.totalTickets,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
    {
      icon: BarChart3,
      label: "Services Up",
      value: metrics.servicesUp,
      color: "bg-green-500/10 text-green-600 dark:text-green-400",
      borderColor: "border-green-200 dark:border-green-800",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.username || "Admin"}. Here's an overview of your platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((card, index) => {
          const IconComponent = card.icon;
          return (
            <div
              key={index}
              className={`rounded-lg border ${card.borderColor} bg-card p-6 shadow-sm transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-2">
                    {loading ? "-" : card.value}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${card.color}`}>
                  <IconComponent className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="col-span-5 lg:col-span-3">
          <MarketCryptoTable />
        </div>
        <div className="col-span-5 space-y-8 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-xl font-bold">BREAKING NEWS</h2>
            <MarketNewsCard />
          </div>
          <AdminPriceChart />
        </div>
      </div>
    </div>
  );
}

