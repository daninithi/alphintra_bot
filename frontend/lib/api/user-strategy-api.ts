/**
 * User Strategy Import API
 * Handles user-specific strategy import, publish request, etc.
 * Calls trading-service via the API Gateway (port 8790).
 */
import { getToken } from "@/lib/auth";
import { buildGatewayUrl } from "@/lib/config/gateway";

const BASE = (path: string) => buildGatewayUrl(`/trading${path}`);

export interface UserStrategy {
  strategy_id: string;
  name: string;
  description: string;
  type: "user_created" | "marketplace";
  price: number;
  publish_status: "private" | "pending_review" | "approved" | "rejected";
  reject_reason?: string | null;
  python_class?: string;
  strategy_file?: string;
  author_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UploadUserStrategyData {
  name: string;
  description: string;
  price: number;
  file: File;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return { Authorization: `Bearer ${token}` };
}

/** Upload a private strategy file */
export async function uploadUserStrategy(
  data: UploadUserStrategyData
): Promise<UserStrategy> {
  const formData = new FormData();
  formData.append("name", data.name);
  formData.append("description", data.description);
  formData.append("price", data.price.toString());
  formData.append("file", data.file);

  const res = await fetch(BASE("/api/user/strategies/upload"), {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Upload failed (${res.status})`);
  }

  const json = await res.json();
  return json.data as UserStrategy;
}

/** Get all strategies imported by the current user */
export async function getUserImportedStrategies(): Promise<UserStrategy[]> {
  const res = await fetch(BASE("/api/user/strategies"), {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Failed to fetch strategies (${res.status})`);
  }

  const json = await res.json();
  return (json.data ?? []) as UserStrategy[];
}

/** Delete a user's own imported strategy */
export async function deleteUserStrategy(strategyId: string): Promise<void> {
  const res = await fetch(
    BASE(`/api/user/strategies/${strategyId}`),
    { method: "DELETE", headers: authHeaders() }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Delete failed (${res.status})`);
  }
}

/** Request to publish a strategy to the marketplace */
export async function requestPublishStrategy(
  strategyId: string,
  price: number
): Promise<void> {
  const formData = new FormData();
  formData.append("price", price.toString());

  const res = await fetch(
    BASE(`/api/user/strategies/${strategyId}/request-publish`),
    { method: "POST", headers: authHeaders(), body: formData }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
}

/** Get file content of user's own strategy */
export async function getUserStrategyContent(strategyId: string): Promise<string> {
  const res = await fetch(
    BASE(`/api/user/strategies/${strategyId}/content`),
    { headers: authHeaders() }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Failed to read file (${res.status})`);
  }

  const json = await res.json();
  return json.data.content as string;
}
