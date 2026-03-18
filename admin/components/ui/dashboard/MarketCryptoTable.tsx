"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { marketJsonFetcher } from "@/lib/market/fetchers";
import { MarketCoin } from "@/lib/market/types";
import { useTheme } from "next-themes";

const rowsPerPage = 10;

export default function MarketCryptoTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [fallbackData, setFallbackData] = useState<MarketCoin[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();

  const { data, error, isLoading } = useSWR<MarketCoin[]>(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h",
    marketJsonFetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 8000,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    const raw = window.localStorage.getItem("admin-market-coins");
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as
        | MarketCoin[]
        | { items: MarketCoin[]; updatedAt?: number };

      if (Array.isArray(parsed)) {
        setFallbackData(parsed);
      } else if (parsed && Array.isArray(parsed.items)) {
        setFallbackData(parsed.items);
        if (typeof parsed.updatedAt === "number") {
          setLastUpdatedAt(parsed.updatedAt);
        }
      }
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    if (Array.isArray(data) && data.length > 0) {
      setFallbackData(data);
      const updatedAt = Date.now();
      setLastUpdatedAt(updatedAt);
      window.localStorage.setItem("admin-market-coins", JSON.stringify({ items: data, updatedAt }));
    }
  }, [data]);

  const effectiveData = Array.isArray(data) && data.length > 0 ? data : fallbackData;
  const dataSource = Array.isArray(data) && data.length > 0 ? "live" : "cached";
  const lastUpdatedText = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "unknown";

  if (isLoading && effectiveData.length === 0) {
    return <div className="text-center text-muted-foreground">Loading...</div>;
  }

  if (error && effectiveData.length === 0) {
    return <div className="text-center text-red-500">Failed to load data</div>;
  }

  const totalPages = Math.max(1, Math.ceil((effectiveData.length || 0) / rowsPerPage));
  const paginatedData =
    effectiveData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage) || [];

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getSmartPages = (current: number, total: number): (number | string)[] => {
    const delta = 1;
    const pages: (number | string)[] = [];

    for (let i = 1; i <= total; i += 1) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }

    return pages;
  };

  const isDark = resolvedTheme === "dark";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-xl font-semibold">Market Data</h2>
      {effectiveData.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">
          Last updated at {lastUpdatedText} ({dataSource})
        </p>
      )}
      {error && effectiveData.length > 0 && (
        <p className="mb-3 text-xs text-yellow-500">Live update failed temporarily. Showing last successful data.</p>
      )}
      <div className={`overflow-x-auto rounded-lg ${isDark ? "bg-[#0a0a1a]" : "bg-white"}`}>
        <table className="min-w-full text-left text-sm">
          <thead className={`${isDark ? "bg-[#101020] text-gray-400" : "bg-gray-200 text-gray-600"} text-xs uppercase`}>
            <tr>
              <th className="px-4 py-3">Coin</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Price (USD)</th>
              <th className="px-4 py-3">Market Cap</th>
              <th className="px-4 py-3">24h Change</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((coin, i) => (
              <tr
                key={coin.id}
                className={`${isDark ? "border-[#1a1a2e] hover:bg-[#141426]" : "border-gray-300 hover:bg-gray-100"} border-b`}
              >
                <td className="flex items-center gap-2 px-4 py-3 font-bold">
                  <span>{String((currentPage - 1) * rowsPerPage + i + 1).padStart(2, "0")}</span>
                  <img src={coin.image} alt={coin.name} className="h-6 w-6" />
                  <span>{coin.name}</span>
                </td>
                <td className="px-4 py-3">{coin.symbol.toUpperCase()}</td>
                <td className="px-4 py-3">
                  ${coin.current_price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-3">${coin.market_cap.toLocaleString("en-US")}</td>
                <td
                  className={`px-4 py-3 ${
                    coin.price_change_percentage_24h >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {coin.price_change_percentage_24h.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1 text-gray-400">
        <button
          className="h-8 w-8 hover:text-yellow-500"
          disabled={currentPage === 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft size={16} />
        </button>

        {getSmartPages(currentPage, totalPages).map((num, idx) =>
          typeof num === "number" ? (
            <button
              key={`${num}-${idx}`}
              onClick={() => goToPage(num)}
              className={`h-6 w-6 rounded-lg text-sm ${
                num === currentPage
                  ? "border border-yellow-500 text-yellow-500"
                  : isDark
                    ? "hover:text-white"
                    : "hover:text-black"
              }`}
            >
              {num}
            </button>
          ) : (
            <span key={`ellipsis-${idx}`} className="px-2">
              ...
            </span>
          )
        )}

        <button
          className="h-8 w-8 hover:text-yellow-500"
          disabled={currentPage === totalPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
