import { NextResponse } from "next/server";

type ServiceStatus = "UP" | "DOWN";

type MonitoredService = {
  id: string;
  name: string;
  baseUrl: string;
  healthPaths: string[];
};

type ServiceProbeResult = {
  id: string;
  name: string;
  status: ServiceStatus;
  endpoint: string | null;
  statusCode: number | null;
  responseTimeMs: number | null;
  checkedAt: string;
  details: string;
};

const DEFAULT_TIMEOUT_MS = 3500;

const MONITORED_SERVICES: MonitoredService[] = [
  {
    id: "api-gateway",
    name: "API Gateway",
    baseUrl: "http://localhost:8790",
    // Gateway does not expose actuator in this setup; probe a public auth route through gateway.
    healthPaths: ["/auth/admin/f/health", "/auth/f/health"],
  },
  {
    id: "discovery-server",
    name: "Discovery Server",
    baseUrl: "http://localhost:8761",
    healthPaths: ["/actuator/health"],
  },
  {
    id: "auth-service",
    name: "Auth Service",
    baseUrl: "http://localhost:8095",
    // Auth service exposes controller health paths directly (no /auth prefix on service port).
    healthPaths: ["/admin/f/health", "/f/health"],
  },
  {
    id: "ticketing-service",
    name: "Ticketing Service",
    baseUrl: "http://localhost:8096",
    healthPaths: ["/actuator/health"],
  },
  {
    id: "wallet-service",
    name: "Wallet Service",
    baseUrl: "http://localhost:8000",
    healthPaths: ["/health", "/"],
  },
  {
    id: "trading-service",
    name: "Trading Service",
    baseUrl: "http://localhost:8001",
    healthPaths: ["/health", "/status"],
  },
  {
    id: "marketplace-service",
    name: "Marketplace Service",
    baseUrl: "http://localhost:8097",
    healthPaths: ["/actuator/health", "/marketplace/strategies"],
  },
];

const normalizeHealthStatus = (payload: unknown): ServiceStatus | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const statusValue = (payload as Record<string, unknown>).status;
  if (typeof statusValue !== "string") {
    return null;
  }

  const normalized = statusValue.toUpperCase();
  if (normalized === "UP" || normalized === "HEALTHY" || normalized === "SUCCESS") {
    return "UP";
  }

  if (normalized === "DOWN" || normalized === "UNHEALTHY" || normalized === "ERROR") {
    return "DOWN";
  }

  return null;
};

const probeUrl = async (url: string) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });

    const elapsed = Date.now() - startedAt;
    const rawBody = await response.text();

    let parsedBody: unknown = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = null;
    }

    return {
      ok: response.ok,
      statusCode: response.status,
      elapsed,
      parsedBody,
      rawBody,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const probeService = async (service: MonitoredService): Promise<ServiceProbeResult> => {
  const checkedAt = new Date().toISOString();

  for (const path of service.healthPaths) {
    const url = `${service.baseUrl}${path}`;

    try {
      const result = await probeUrl(url);
      const derivedStatus = normalizeHealthStatus(result.parsedBody);

      if (result.ok) {
        const details =
          derivedStatus === "DOWN"
            ? "Service responded but reported unhealthy status."
            : "Service is reachable and responding.";

        return {
          id: service.id,
          name: service.name,
          status: derivedStatus ?? "UP",
          endpoint: url,
          statusCode: result.statusCode,
          responseTimeMs: result.elapsed,
          checkedAt,
          details,
        };
      }

      if (result.statusCode >= 500) {
        return {
          id: service.id,
          name: service.name,
          status: "DOWN",
          endpoint: url,
          statusCode: result.statusCode,
          responseTimeMs: result.elapsed,
          checkedAt,
          details: "Service returned a server error response.",
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";

      if (path === service.healthPaths[service.healthPaths.length - 1]) {
        return {
          id: service.id,
          name: service.name,
          status: "DOWN",
          endpoint: url,
          statusCode: null,
          responseTimeMs: null,
          checkedAt,
          details: `Unable to connect: ${message}`,
        };
      }
    }
  }

  return {
    id: service.id,
    name: service.name,
    status: "DOWN",
    endpoint: null,
    statusCode: null,
    responseTimeMs: null,
    checkedAt,
    details: "No valid health endpoint responded.",
  };
};

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await Promise.all(MONITORED_SERVICES.map((service) => probeService(service)));
  const upCount = results.filter((service) => service.status === "UP").length;

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      summary: {
        total: results.length,
        up: upCount,
        down: results.length - upCount,
      },
      services: results,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
