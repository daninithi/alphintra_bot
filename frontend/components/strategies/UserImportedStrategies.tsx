"use client";

import { useState } from "react";
import {
  FileCode2,
  Trash2,
  Globe,
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  DollarSign,
  Eye,
} from "lucide-react";
import {
  UserStrategy,
  deleteUserStrategy,
  requestPublishStrategy,
} from "@/lib/api/user-strategy-api";
import UpgradeModal from "@/components/subscription/UpgradeModal";
import { getSubscriptionStatus } from "@/lib/api/subscription-api";
import { getUserId } from "@/lib/auth";

interface Props {
  strategies: UserStrategy[];
  onRefresh: () => void;
}

const STATUS_CONFIG = {
  private: {
    label: "Private",
    icon: Lock,
    className: "text-muted-foreground bg-muted",
  },
  pending_review: {
    label: "Pending Review",
    icon: Clock,
    className: "text-yellow-600 bg-yellow-500/10",
  },
  approved: {
    label: "Published",
    icon: CheckCircle2,
    className: "text-green-600 bg-green-500/10",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "text-red-500 bg-red-500/10",
  },
} as const;

interface PublishDialogProps {
  strategy: UserStrategy;
  onConfirm: (price: number) => void;
  onClose: () => void;
}

function PublishRequestDialog({ strategy, onConfirm, onClose }: PublishDialogProps) {
  const [price, setPrice] = useState(strategy.price ?? 0);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(price);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold">Request to Publish</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Your strategy will be sent to the admin for review. Once approved it will appear
          in the public marketplace. Set{" "}
          <span className="font-medium text-foreground">0</span> for a free strategy.
        </p>

        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5">
            Listing Price (USD)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="number"
              min={0}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {price === 0 ? "Free — anyone can use it" : `Paid — buyers pay $${price}`}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-2 text-sm disabled:opacity-50 transition-colors"
          >
            {loading ? "Sending…" : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserImportedStrategies({ strategies, onRefresh }: Props) {
  const [publishTarget, setPublishTarget] = useState<UserStrategy | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handlePublishClick = async (s: UserStrategy) => {
    const status = await getSubscriptionStatus(Number(getUserId()));
    if (!status.isSubscribed) {
      setShowUpgrade(true);
    } else {
      setPublishTarget(s);
    }
  };

  const handleDelete = async (strategy: UserStrategy) => {
    if (!confirm(`Delete "${strategy.name}"? This cannot be undone.`)) return;
    setDeletingId(strategy.strategy_id);
    setActionError("");
    try {
      await deleteUserStrategy(strategy.strategy_id);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message ?? "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublishConfirm = async (price: number) => {
    if (!publishTarget) return;
    setActionError("");
    try {
      await requestPublishStrategy(publishTarget.strategy_id, price);
      setPublishTarget(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message ?? "Request failed");
      setPublishTarget(null);
    }
  };

  if (strategies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <FileCode2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">No imported strategies yet</p>
      </div>
    );
  }

  return (
    <>
      {actionError && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">
          {actionError}
        </div>
      )}

      <div className="space-y-3">
        {strategies.map((s) => {
          const status = STATUS_CONFIG[s.publish_status] ?? STATUS_CONFIG.private;
          const StatusIcon = status.icon;
          const canPublish = s.publish_status === "private";
          const canDelete = true;

          return (
            <div
              key={s.strategy_id}
              className="rounded-xl border border-border bg-card p-4 hover:border-yellow-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                    <FileCode2 className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {s.description}
                    </p>

                    {/* Reject reason */}
                    {s.publish_status === "rejected" && s.reject_reason && (
                      <p className="mt-1.5 text-xs text-red-500 bg-red-500/10 rounded px-2 py-1">
                        Rejected: {s.reject_reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status + Price */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                  {s.price > 0 ? (
                    <span className="text-xs text-muted-foreground">${s.price}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Free</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2 justify-end border-t border-border pt-3">
                {canPublish && (
                  <button
                    onClick={() => handlePublishClick(s)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/40 px-3 py-1.5 text-xs text-yellow-500 hover:bg-yellow-500/10 transition-colors"
                  >
                    <Globe className="w-3 h-3" />
                    Request Publish
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(s)}
                    disabled={deletingId === s.strategy_id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    {deletingId === s.strategy_id ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {publishTarget && (
        <PublishRequestDialog
          strategy={publishTarget}
          onConfirm={handlePublishConfirm}
          onClose={() => setPublishTarget(null)}
        />
      )}

      {showUpgrade && (
        <UpgradeModal reason="publish" onClose={() => setShowUpgrade(false)} />
      )}
    </>
  );
}
