import { useState } from "react";
import { X, Crown, Check, Loader2 } from "lucide-react";
import { startSubscriptionCheckout } from "@/lib/api/subscription-api";

interface Props {
  reason: "import" | "purchase" | "publish";
  onClose: () => void;
}

const REASON_MESSAGES = {
  import:   { title: "Import Limit Reached", body: "Free users can import up to 2 strategies. Upgrade to Pro to import unlimited strategies." },
  purchase: { title: "Purchase Limit Reached", body: "Free users can purchase up to 2 strategies. Upgrade to Pro to buy unlimited strategies from the marketplace." },
  publish:  { title: "Pro Feature", body: "Publishing strategies to the marketplace is a Pro-only feature. Upgrade to Pro to submit your strategies for review." },
};

const FEATURES = [
  "Unlimited strategy imports",
  "Unlimited marketplace purchases",
  "Request to publish your own strategies",
  "Access all default + marketplace strategies",
];

export default function UpgradeModal({ reason, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const msg = REASON_MESSAGES[reason];

  const handleUpgrade = async () => {
    setLoading(true);
    setError("");
    try {
      await startSubscriptionCheckout('yearly');
    } catch (err: any) {
      setError(err.message ?? "Failed to start checkout");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Upgrade to Pro</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Reason */}
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3">
            <p className="text-sm font-medium text-yellow-500">{msg.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{msg.body}</p>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Pro includes:</p>
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 text-center">
            <p className="text-3xl font-bold text-yellow-500">$100</p>
            <p className="text-sm text-muted-foreground mt-1">per year</p>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* CTA */}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to Stripe…
              </>
            ) : (
              <>
                <Crown className="w-4 h-4" />
                Upgrade — $100/yr
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Secure payment via Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
