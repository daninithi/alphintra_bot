"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { tradingStrategyAPI, Strategy } from "@/lib/api/trading-strategy-api";
import StrategyUploadForm from "@/components/strategies/StrategyUploadForm";
import PendingReviewStrategies from "@/components/strategies/PendingReviewStrategies";

export default function StrategiesPage() {
  const [mounted, setMounted] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"strategies" | "pending">("strategies");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [viewingContent, setViewingContent] = useState<{ id: string; content: string } | null>(null);

  const [pendingStrategies, setPendingStrategies] = useState<Strategy[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filterType = filter === "all" ? undefined : filter;
      const data = await tradingStrategyAPI.getStrategies(filterType);
      setStrategies(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load strategies");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadPendingStrategies = useCallback(async () => {
    setLoadingPending(true);
    try {
      const data = await tradingStrategyAPI.getPendingReviewStrategies();
      setPendingStrategies(data);
    } catch {
      setPendingStrategies([]);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const handleDelete = async (strategyId: string) => {
    if (!confirm("Are you sure you want to delete this strategy? This action cannot be undone.")) {
      return;
    }

    try {
      await tradingStrategyAPI.deleteStrategy(strategyId);
      loadStrategies();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to delete strategy");
    }
  };

  const handleViewContent = async (strategyId: string) => {
    try {
      const content = await tradingStrategyAPI.getStrategyContent(strategyId);
      setViewingContent({ id: strategyId, content });
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to load strategy content");
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
      loadStrategies();
      loadPendingStrategies();
    }
  }, [mounted, isAuthenticated, filter]);

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Show upload form modal
  if (showUploadForm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="my-8">
          <StrategyUploadForm
            onSuccess={() => {
              setShowUploadForm(false);
              loadStrategies();
            }}
            onCancel={() => setShowUploadForm(false)}
          />
        </div>
      </div>
    );
  }

  // Show content viewer modal
  if (viewingContent) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Strategy Code</h2>
            <button
              onClick={() => setViewingContent(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{viewingContent.content}</code>
            </pre>
          </div>
        </div>
      </div>
    );
  }

  const filteredStrategies = strategies.filter(
    (s) => s.created_by === 'admin'
  );
  const stats = {
    total: strategies.length,
    free: strategies.filter((s) => s.price === 0).length,
    paid: strategies.filter((s) => s.price > 0).length,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Strategy Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage trading strategies available to users
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Strategies</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Free Strategies</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.free}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Paid Strategies</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.paid}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Pending Review</div>
          <div className="text-3xl font-bold text-yellow-500">{pendingStrategies.length}</div>
        </div>
      </div>

      {/* Top-level Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("strategies")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "strategies"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          All Strategies
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "pending"
              ? "border-yellow-500 text-yellow-500"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Pending Review
          {pendingStrategies.length > 0 && (
            <span className="rounded-full bg-yellow-500 text-white text-xs font-bold px-2 py-0.5">
              {pendingStrategies.length}
            </span>
          )}
        </button>
      </div>

      {/* Pending Review Tab */}
      {activeTab === "pending" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              User Publish Requests
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Download and test each strategy manually before approving or rejecting.
            </p>
          </div>
          {loadingPending ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
          ) : (
            <PendingReviewStrategies
              strategies={pendingStrategies}
              onRefresh={loadPendingStrategies}
            />
          )}
        </div>
      )}

      {/* Strategies Tab */}
      {activeTab === "strategies" && (
        <>
      {/* Actions and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg ${
                filter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("default")}
              className={`px-4 py-2 rounded-lg ${
                filter === "default"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              Free
            </button>
            <button
              onClick={() => setFilter("marketplace")}
              className={`px-4 py-2 rounded-lg ${
                filter === "marketplace"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              Paid
            </button>
          </div>
          <button
            onClick={() => setShowUploadForm(true)}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Upload Strategy</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Strategies Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading strategies...</div>
        ) : filteredStrategies.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            No strategies found. Upload your first strategy!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Purchases
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStrategies.map((strategy) => (
                  <tr key={strategy.strategy_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {strategy.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {strategy.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          strategy.type === "default"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {strategy.type === "default" ? "Free" : "Paid"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {strategy.price === 0 ? "Free" : `$${strategy.price.toFixed(2)}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {strategy.total_purchases}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {strategy.created_at ? new Date(strategy.created_at).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewContent(strategy.strategy_id)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View Code
                      </button>
                      <button
                        onClick={() => handleDelete(strategy.strategy_id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
