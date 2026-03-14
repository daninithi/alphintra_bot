"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { AdminManagedUser, authServiceApiClient } from "@/lib/api/auth-service-api";

const statusClassMap: Record<string, string> = {
  ACTIVE: "text-green-600 dark:text-green-400",
  SUSPENDED: "text-yellow-600 dark:text-yellow-400",
  BANNED: "text-red-600 dark:text-red-400",
};

const accountStatuses = ["ALL", "ACTIVE", "SUSPENDED", "BANNED"] as const;

const displayStatus = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();

export default function UsersPage() {
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof accountStatuses)[number]>("ALL");
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  const loadUsers = async () => {
    setLoadingUsers(true);
    setLoadError("");
    try {
      const data = await authServiceApiClient.getManagedUsers();
      setUsers(data);
    } catch (error: any) {
      setLoadError(error?.response?.data?.error || "Failed to load users from server.");
    } finally {
      setLoadingUsers(false);
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
    if (mounted && isAuthenticated) {
      loadUsers();
    }
  }, [mounted, isAuthenticated]);

  const resetFilters = () => {
    setUserIdFilter("");
    setNameFilter("");
    setEmailFilter("");
    setStatusFilter("ALL");
  };

  const normalizedUserIdFilter = userIdFilter.trim().toLowerCase();
  const normalizedNameFilter = nameFilter.trim().toLowerCase();
  const normalizedEmailFilter = emailFilter.trim().toLowerCase();

  const filteredUsers = users.filter((user) => {
    const matchesUserId = normalizedUserIdFilter === "" || user.id.toString().toLowerCase().includes(normalizedUserIdFilter);
    const matchesName = normalizedNameFilter === "" || (user.name || "").toLowerCase().includes(normalizedNameFilter);
    const matchesEmail = normalizedEmailFilter === "" || user.email.toLowerCase().includes(normalizedEmailFilter);
    const matchesStatus = statusFilter === "ALL" || user.accountStatus === statusFilter;

    return matchesUserId && matchesName && matchesEmail && matchesStatus;
  });

  const hasActiveFilters =
    userIdFilter.trim() !== "" ||
    nameFilter.trim() !== "" ||
    emailFilter.trim() !== "" ||
    statusFilter !== "ALL";

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
      <h1 className="text-3xl font-bold text-foreground">User Management</h1>

      {loadError && (
        <p className="text-sm text-red-500">{loadError}</p>
      )}

      <div>
        <button
          onClick={loadUsers}
          disabled={loadingUsers}
          className="rounded-md border border-border px-3 py-1.5 hover:bg-muted/40 disabled:opacity-50"
        >
          {loadingUsers ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">User ID</span>
            <input
              type="text"
              value={userIdFilter}
              onChange={(event) => setUserIdFilter(event.target.value)}
              placeholder="Search by user ID"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Name</span>
            <input
              type="text"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Search by name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Email</span>
            <input
              type="text"
              value={emailFilter}
              onChange={(event) => setEmailFilter(event.target.value)}
              placeholder="Search by email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Account Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as (typeof accountStatuses)[number])}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
            >
              {accountStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All statuses" : displayStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">User ID</th>
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold">Email</th>
              <th className="text-left px-4 py-3 font-semibold">Account Status</th>
              <th className="text-left px-4 py-3 font-semibold">Created Date</th>
              <th className="text-left px-4 py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="px-4 py-3">{user.id}</td>
                <td className="px-4 py-3">{user.name || "-"}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className={`px-4 py-3 font-medium ${statusClassMap[user.accountStatus]}`}>
                  {displayStatus(user.accountStatus)}
                </td>
                <td className="px-4 py-3">{new Date(user.createdDate).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/users/${user.id}`}
                    className="inline-flex items-center rounded-md border border-border px-3 py-1.5 hover:bg-muted/40"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {!loadingUsers && filteredUsers.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                  {users.length === 0 ? "No users found." : "No users match the current filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
