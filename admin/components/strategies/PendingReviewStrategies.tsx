'use client';

import { useState } from 'react';
import {
  Clock,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  DollarSign,
  FileCode2,
} from 'lucide-react';
import { Strategy, tradingStrategyAPI } from '@/lib/api/trading-strategy-api';

interface Props {
  strategies: Strategy[];
  onRefresh: () => void;
}

interface RejectDialogProps {
  strategy: Strategy;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

function RejectDialog({ strategy, onConfirm, onClose }: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    await onConfirm(reason.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Reject Strategy</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Rejecting <span className="font-medium text-gray-900 dark:text-white">{strategy.name}</span>.
          Provide a reason so the user can improve their submission.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Missing stop-loss logic, does not extend BaseStrategy correctly..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium py-2 text-sm disabled:opacity-50 transition-colors"
          >
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PendingReviewStrategies({ strategies, onRefresh }: Props) {
  const [rejectTarget, setRejectTarget] = useState<Strategy | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const handleDownload = async (strategy: Strategy) => {
    try {
      const fileName = `${strategy.name.replace(/\s+/g, '_')}.py`;
      await tradingStrategyAPI.downloadStrategyFile(strategy.strategy_id, fileName);
    } catch (err: any) {
      setActionError(err?.response?.data?.detail ?? err.message ?? 'Download failed');
    }
  };

  const handleApprove = async (strategy: Strategy) => {
    if (!confirm(`Approve and publish "${strategy.name}" to the marketplace?`)) return;
    setProcessingId(strategy.strategy_id);
    setActionError('');
    try {
      await tradingStrategyAPI.approveStrategy(strategy.strategy_id);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.response?.data?.detail ?? err.message ?? 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    setProcessingId(rejectTarget.strategy_id);
    setActionError('');
    try {
      await tradingStrategyAPI.rejectStrategy(rejectTarget.strategy_id, reason);
      setRejectTarget(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.response?.data?.detail ?? err.message ?? 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  if (strategies.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-14 text-center">
        <Clock className="w-8 h-8 mx-auto mb-3 text-gray-400 opacity-50" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No strategies pending review</p>
      </div>
    );
  }

  return (
    <>
      {actionError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
        </div>
      )}

      <div className="space-y-4">
        {strategies.map((s) => {
          const isProcessing = processingId === s.strategy_id;

          return (
            <div
              key={s.strategy_id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10">
                    <FileCode2 className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {s.description}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        User ID: {s.author_id}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {s.price > 0 ? `$${s.price}` : 'Free'}
                      </span>
                      {s.updated_at && (
                        <span>
                          Requested: {new Date(s.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-600">
                  <Clock className="w-3 h-3" />
                  Pending Review
                </span>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleDownload(s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download & Test
                </button>

                <button
                  onClick={() => handleApprove(s)}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 hover:bg-green-600 px-3 py-1.5 text-xs text-white font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {isProcessing ? 'Processing…' : 'Approve & Publish'}
                </button>

                <button
                  onClick={() => setRejectTarget(s)}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3 h-3" />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {rejectTarget && (
        <RejectDialog
          strategy={rejectTarget}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </>
  );
}
