"use client";

import AdminBitcoinChart from "@/components/ui/dashboard/AdminBitcoinChart";

export default function AdminPriceChart() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 text-xl font-bold">BITCOIN</div>
      <AdminBitcoinChart days={365} />
    </div>
  );
}
