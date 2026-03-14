"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { AdminManagedUser, LoginHistoryRecord, UserStrategyInfo, authServiceApiClient } from "@/lib/api/auth-service-api";

const displayStatus = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();

export default function UserDetailsPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AdminManagedUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [strategies, setStrategies] = useState<UserStrategyInfo[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>([]);
  const [loadingLoginHistory, setLoadingLoginHistory] = useState(false);

  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  const userId = Number(params?.id);

  const loadUser = async () => {
    if (!userId || Number.isNaN(userId)) {
      setError("Invalid user id.");
      return;
    }
    setLoadingUser(true);
    setError("");
    try {
      const data = await authServiceApiClient.getManagedUserById(userId);
      setUser(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load user.");
    } finally {
      setLoadingUser(false);
    }
  };

  const loadStrategies = async () => {
    if (!userId || Number.isNaN(userId)) return;
    setLoadingStrategies(true);
    try {
      const data = await authServiceApiClient.getUserStrategies(userId);
      setStrategies(data);
    } catch {
      // Trading service may not be running; fail silently
    } finally {
      setLoadingStrategies(false);
    }
  };

  const loadLoginHistory = async () => {
    if (!userId || Number.isNaN(userId)) return;
    setLoadingLoginHistory(true);
    try {
      const data = await authServiceApiClient.getUserLoginHistory(userId);
      setLoginHistory(data);
    } catch {
      // fail silently
    } finally {
      setLoadingLoginHistory(false);
    }
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
    if (mounted && isAuthenticated && userId) {
      loadUser();
      loadStrategies();
      loadLoginHistory();
    }
  }, [mounted, isAuthenticated, userId]);

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

  if (loadingUser && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading user...</div>
      </div>
    );
  }

  if (!loadingUser && !user) {
    return <p className="text-lg">User not found.</p>;
  }

  const handleSuspend = async () => {
    if (!user) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const updated = await authServiceApiClient.suspendManagedUser(user.id);
      setUser(updated);
      setMessage("Account suspended.");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to suspend account.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this account?")) {
      return;
    }

    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await authServiceApiClient.deleteManagedUser(user.id);
      router.push("/users");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to delete user.");
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">User Details</h1>
        <button
          onClick={() => router.push("/users")}
          className="rounded-md border border-border px-4 py-2 hover:bg-muted/40"
        >
          Back to User List
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-xl font-semibold mb-4">Personal info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">User ID</p>
            <p className="font-medium">{user?.id ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">{user?.name || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Account Status</p>
            <p className="font-medium">{user ? displayStatus(user.accountStatus) : "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email Verified</p>
            <p className="font-medium">{user?.emailVerified ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Created Date</p>
            <p className="font-medium">{user ? new Date(user.createdDate).toLocaleString() : "-"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-xl font-semibold mb-4">Login history</h2>
        {loadingLoginHistory ? (
          <p className="text-sm text-muted-foreground">Loading login history...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold ">#</th>
                  <th className="text-left px-4 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.length > 0 ? (
                  loginHistory.map((record, index) => (
                    <tr key={record.id} className="border-t border-border">
                      <td className="px-4 py-3 text-muted-foreground ">{index + 1}</td>
                      <td className="px-4 py-3">{new Date(record.loginAt).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground" colSpan={2}>
                      No login history available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-xl font-semibold mb-4">Strategies</h2>
        {loadingStrategies ? (
          <p className="text-sm text-muted-foreground">Loading strategies...</p>
        ) : strategies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No strategies found for this user.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Strategy</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Access</th>
                  <th className="text-left px-4 py-3 font-semibold">Bot Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s) => (
                  <tr key={s.strategy_id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.strategy_id}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {s.type === "user_created" ? "User Created" : s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {s.access_type === "default" ? "Default" : s.access_type === "purchased" ? "Purchased" : s.access_type === "created" ? "Created" : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {s.bot_status === "running" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>Running
                        </span>
                      ) : s.bot_status === "stopped" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Stopped
                        </span>
                      ) : s.bot_status === "error" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Never run
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.last_run ? new Date(s.last_run).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button disabled={actionLoading || loadingUser} onClick={handleSuspend} className="rounded-md bg-yellow-500 px-4 py-2 text-black font-medium hover:bg-yellow-600 disabled:opacity-50">
            Suspend account
          </button>
          <button disabled={actionLoading || loadingUser} onClick={handleDelete} className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50">
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
