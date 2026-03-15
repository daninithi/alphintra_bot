"use client";

import { useState, useRef } from "react";
import {
  X,
  Upload,
  FileCode2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { uploadUserStrategy } from "@/lib/api/user-strategy-api";

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

const BASE_MODAL_TEMPLATE = `"""
Your Strategy Description
"""
from strategies.base_strategy import BaseStrategy, TradingSignal, SignalType
import pandas as pd
from typing import Dict


class MyCustomStrategy(BaseStrategy):
    def __init__(self):
        super().__init__(name="My Custom Strategy")
        self.timeframe = "1h"   # or list: self.timeframes = ["15m", "1h"]

    def analyze(
        self,
        symbol: str,
        data: Dict[str, pd.DataFrame],
        current_price: float
    ) -> TradingSignal:
        df = data.get(self.timeframe)
        if df is None or df.empty:
            return TradingSignal(signal=SignalType.HOLD, confidence=0, reason="No data")

        # --- Your logic here ---
        return TradingSignal(
            signal=SignalType.BUY,
            confidence=75.0,
            reason="Example signal",
            entry_price=current_price,
        )

    def get_description(self) -> str:
        return "Describe what your strategy does."
`;

const GUIDELINES = [
  {
    title: "Inherit from BaseStrategy",
    body: "Your class must extend BaseStrategy: class MyStrategy(BaseStrategy)",
  },
  {
    title: "Implement analyze()",
    body: "This is the only required method. It receives symbol, data (dict of timeframe → DataFrame), and current_price. Return a TradingSignal.",
  },
  {
    title: "TradingSignal fields",
    body: "signal: SignalType.BUY / SELL / HOLD  |  confidence: 0–100  |  reason: string  |  entry_price, stop_loss, take_profit (optional)",
  },
  {
    title: "Declare timeframes",
    body: "Set self.timeframe = '1h' (single) or self.timeframes = ['15m','1h'] (multi) in __init__ so the bot knows what data to fetch.",
  },
  {
    title: "File size limit",
    body: "Max 1 MB. Only .py files accepted. Must be valid UTF-8 Python.",
  },
];

export default function UserStrategyImportModal({ onSuccess, onClose }: Props) {
  const [step, setStep] = useState<"guidelines" | "upload">("guidelines");
  const [guidelinesOpen, setGuidelinesOpen] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".py")) {
      setError("Only .py files are accepted");
      return;
    }
    setFile(f);
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!file) return setError("Please select a .py file");
    if (!name.trim()) return setError("Strategy name is required");
    if (!description.trim()) return setError("Description is required");
    if (price < 0) return setError("Price cannot be negative");

    setUploading(true);
    try {
      await uploadUserStrategy({ name, description, price, file });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <FileCode2 className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Import Strategy</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Guidelines Section */}
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5">
            <button
              type="button"
              onClick={() => setGuidelinesOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2 text-yellow-500 font-medium text-sm">
                <Info className="w-4 h-4" />
                Base Model Guidelines — read before uploading
              </div>
              {guidelinesOpen ? (
                <ChevronUp className="w-4 h-4 text-yellow-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-yellow-500" />
              )}
            </button>

            {guidelinesOpen && (
              <div className="border-t border-yellow-500/20 px-4 pb-4 pt-3 space-y-3">
                {GUIDELINES.map((g) => (
                  <div key={g.title} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{g.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{g.body}</p>
                    </div>
                  </div>
                ))}

                {/* Template toggle */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setTemplateOpen((o) => !o)}
                    className="text-xs text-yellow-500 underline underline-offset-2 flex items-center gap-1"
                  >
                    {templateOpen ? "Hide" : "Show"} base template
                    {templateOpen ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  {templateOpen && (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono text-muted-foreground leading-5">
                      {BASE_MODAL_TEMPLATE}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Upload Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Strategy Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My EMA Crossover"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe how your strategy works..."
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40 resize-none"
                required
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Strategy File (.py) <span className="text-red-500">*</span>
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-border hover:border-yellow-500/50"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".py"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p>Drop your .py file here or click to browse</p>
                    <p className="text-xs mt-1">Must extend BaseStrategy</p>
                  </div>
                )}
              </div>
            </div>

            {/* Visibility notice */}
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Visibility:</span> Your
              strategy will be <span className="text-yellow-500 font-medium">private</span> by
              default — only you can use it in your bots. You can request to publish it
              to the marketplace after import.
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <p className="text-sm text-green-500">Strategy imported successfully!</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="rounded-lg border border-border px-5 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || success}
                className="rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-5 py-2 text-sm disabled:opacity-50 transition-colors"
              >
                {uploading ? "Importing…" : "Import Strategy"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
