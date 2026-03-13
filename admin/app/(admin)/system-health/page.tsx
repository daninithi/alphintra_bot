"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { gatewayHttpBaseUrl } from "@/lib/config/gateway";

interface ServiceStatus {
  name: string;
  path: string;
  status: "Running" | "Down";
}

const serviceChecks: Omit<ServiceStatus, "status">[] = [
  { name: "Auth service", path: "/auth/f/health" },
  { name: "Trading service", path: "/trading/health" },
  { name: "Wallet service", path: "/wallet/health" },
  { name: "Ticketing service", path: "/ticketing/health" },
];

const fetchWithTimeout = async (url: string, timeout = 4000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function SystemHealthPage() {
  const [mounted, setMounted] = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>(
    serviceChecks.map((service) => ({ ...service, status: "Down" }))
  );
  const [checking, setChecking] = useState(false);

  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  const hasAnyDown = useMemo(
    () => services.some((service) => service.status === "Down"),
    [services]
  );

  const checkServices = async () => {
    setChecking(true);

    const results = await Promise.all(
      serviceChecks.map(async (service) => {
        try {
          const response = await fetchWithTimeout(`${gatewayHttpBaseUrl}${service.path}`);
          return {
            ...service,
            status: response.ok ? "Running" : "Down",
          } as ServiceStatus;
        } catch {
          return {
            ...service,
            status: "Down",
          } as ServiceStatus;
        }
      })
    );

    setServices(results);
    setChecking(false);
  };

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
      checkServices();
    }
  }, [mounted, isAuthenticated]);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-foreground">System & Service Monitoring</h1>
        <button
          onClick={checkServices}
          disabled={checking}
          className="rounded-md border border-border px-4 py-2 hover:bg-muted/40 disabled:opacity-50"
        >
          {checking ? "Checking..." : "Refresh status"}
        </button>
      </div>

      <p className={`text-sm font-medium ${hasAnyDown ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
        {hasAnyDown ? "One or more services are down." : "All services are running."}
      </p>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Service</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.name} className="border-t border-border">
                <td className="px-4 py-3">{service.name}</td>
                <td className="px-4 py-3">
                  <span className={service.status === "Running" ? "text-green-600 dark:text-green-400 font-medium" : "text-red-500 font-medium"}>
                    {service.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
