"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

type ServiceStatus = "UP" | "DOWN";

type ServiceRow = {
  id: string;
  name: string;
  status: ServiceStatus;
  endpoint: string | null;
  statusCode: number | null;
  responseTimeMs: number | null;
  checkedAt: string;
  details: string;
};

type HealthResponse = {
  checkedAt: string;
  summary: {
    total: number;
    up: number;
    down: number;
  };
  services: ServiceRow[];
};

const REFRESH_INTERVAL_MS = 15000;

const statusClassMap: Record<ServiceStatus, string> = {
  UP: "text-green-600 dark:text-green-400",
  DOWN: "text-red-600 dark:text-red-400",
};

export default function SystemHealthPage() {
  const [mounted, setMounted] = useState(false);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [summary, setSummary] = useState({ total: 0, up: 0, down: 0 });

  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  const loadSystemHealth = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/system-health", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch system health.");
      }

      const payload: HealthResponse = await response.json();
      setServices(payload.services);
      setSummary(payload.summary);
      setLastCheckedAt(payload.checkedAt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load system health.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) {
      return;
    }

    loadSystemHealth();
    const timer = window.setInterval(loadSystemHealth, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [mounted, isAuthenticated, loadSystemHealth]);

  const overallStatusLabel = useMemo(() => {
    if (summary.total === 0) {
      return "No services checked";
    }

    if (summary.down === 0) {
      return "All services are running";
    }

    return `${summary.down} service${summary.down === 1 ? "" : "s"} down`;
  }, [summary]);

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">System Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">Live status of all core services in the Alphintra platform.</p>
        </div>

        <button
          onClick={loadSystemHealth}
          disabled={loading}
          className="rounded-md border border-border px-3 py-1.5 hover:bg-muted/40 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Services</p>
          <p className="text-2xl font-semibold mt-1">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Running</p>
          <p className="text-2xl font-semibold mt-1 text-green-600 dark:text-green-400">{summary.up}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Down</p>
          <p className="text-2xl font-semibold mt-1 text-red-600 dark:text-red-400">{summary.down}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Overall Status</p>
        <p className="text-sm text-muted-foreground mt-1">{overallStatusLabel}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Last checked: {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : "-"}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Service</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">HTTP</th>
              <th className="text-left px-4 py-3 font-semibold">Response Time</th>
              <th className="text-left px-4 py-3 font-semibold">Checked At</th>
              <th className="text-left px-4 py-3 font-semibold">Endpoint</th>
              <th className="text-left px-4 py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{service.name}</td>
                <td className={`px-4 py-3 font-semibold ${statusClassMap[service.status]}`}>{service.status}</td>
                <td className="px-4 py-3">{service.statusCode ?? "-"}</td>
                <td className="px-4 py-3">
                  {service.responseTimeMs !== null ? `${service.responseTimeMs} ms` : "-"}
                </td>
                <td className="px-4 py-3">{new Date(service.checkedAt).toLocaleTimeString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{service.endpoint ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">{service.details}</td>
              </tr>
            ))}
            {!loading && services.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                  No services found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
