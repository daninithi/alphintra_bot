"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BitcoinChartPoint } from "@/lib/market/types";
import { useTheme } from "next-themes";

export default function AdminBitcoinChart({ days = 365 }: { days?: number }) {
  const [data, setData] = useState<BitcoinChartPoint[]>([]);
  const [error, setError] = useState<string>("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "cached" | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const rawCache = window.localStorage.getItem("admin-bitcoin-chart");
    if (rawCache) {
      try {
        const parsed = JSON.parse(rawCache) as
          | BitcoinChartPoint[]
          | { points: BitcoinChartPoint[]; updatedAt?: number };

        if (Array.isArray(parsed) && parsed.length > 0) {
          setData(parsed);
          setDataSource("cached");
        } else if (
          !Array.isArray(parsed) &&
          Array.isArray(parsed.points) &&
          parsed.points.length > 0
        ) {
          setData(parsed.points);
          setDataSource("cached");
          if (typeof parsed.updatedAt === "number") {
            setLastUpdatedAt(parsed.updatedAt);
          }
        }
      } catch {
        // ignore malformed cache
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        return res.json();
      })
      .then((result) => {
        const prices = result.prices.map(([timestamp, price]: [number, number]) => ({
          time: new Date(timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          price: Number(price.toFixed(2)),
        }));
        const updatedAt = Date.now();
        setData(prices);
        setError("");
        setDataSource("live");
        setLastUpdatedAt(updatedAt);
        window.localStorage.setItem("admin-bitcoin-chart", JSON.stringify({ points: prices, updatedAt }));
      })
      .catch((err) => {
        console.error("Failed to fetch Bitcoin data:", err);
        setError("Live chart update failed. Showing last successful data.");
        setDataSource((prev) => prev ?? "cached");
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [days]);

  const axisColor = theme === "dark" ? "#020817" : "#ffffff";
  const lastUpdatedText = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "unknown";

  return (
    <div className="h-[220px] w-full">
      {data.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">
          Last updated at {lastUpdatedText} ({dataSource ?? "cached"})
        </p>
      )}
      {error && <p className="mb-2 text-xs text-yellow-500">{error}</p>}
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis dataKey="time" tick={{ fontSize: 10 }} hide />
            <YAxis stroke={axisColor} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#d4af37"
              fill="rgba(212, 175, 55, 0.3)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center text-muted-foreground">Loading...</p>
      )}
    </div>
  );
}
