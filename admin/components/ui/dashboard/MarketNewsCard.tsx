"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Megaphone } from "lucide-react";
import { marketJsonFetcher } from "@/lib/market/fetchers";
import { CryptoCompareNewsResponse } from "@/lib/market/types";
import { useTheme } from "next-themes";

export default function MarketNewsCard() {
  const { resolvedTheme } = useTheme();
  const [fallbackNews, setFallbackNews] = useState<CryptoCompareNewsResponse | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_CRYPTOCOMPARE_API_KEY;

  const newsUrl = apiKey
    ? `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=Cryptocurrency&api_key=${apiKey}`
    : null;

  const { data, error, isLoading } = useSWR<CryptoCompareNewsResponse>(
    newsUrl,
    marketJsonFetcher,
    {
      refreshInterval: 600000,
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryCount: 2,
      errorRetryInterval: 12000,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    const raw = window.localStorage.getItem("admin-market-news");
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as
        | CryptoCompareNewsResponse
        | { payload: CryptoCompareNewsResponse; updatedAt?: number };

      if (parsed && "Data" in parsed && Array.isArray(parsed.Data)) {
        setFallbackNews(parsed);
      } else if (parsed && "payload" in parsed && parsed.payload && Array.isArray(parsed.payload.Data)) {
        setFallbackNews(parsed.payload);
        if (typeof parsed.updatedAt === "number") {
          setLastUpdatedAt(parsed.updatedAt);
        }
      }
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    if (data && Array.isArray(data.Data) && data.Data.length > 0) {
      setFallbackNews(data);
      const updatedAt = Date.now();
      setLastUpdatedAt(updatedAt);
      window.localStorage.setItem("admin-market-news", JSON.stringify({ payload: data, updatedAt }));
    }
  }, [data]);

  const effectiveData = data && Array.isArray(data.Data) ? data : fallbackNews;
  const dataSource = data && Array.isArray(data.Data) ? "live" : "cached";
  const lastUpdatedText = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "unknown";

  if (isLoading && !effectiveData) {
    return <div className="text-center text-muted-foreground">Loading news...</div>;
  }

  if (!apiKey) {
    return <div className="text-center text-yellow-500">Missing NEXT_PUBLIC_CRYPTOCOMPARE_API_KEY</div>;
  }

  if (error && !effectiveData) {
    return <div className="text-center text-yellow-500">Failed to load news</div>;
  }

  const newsItems = Array.isArray(effectiveData?.Data) ? effectiveData!.Data.slice(0, 3) : [];
  const isDark = resolvedTheme === "dark";

  return (
    <div className="space-y-4">
      {effectiveData && (
        <p className="text-xs text-muted-foreground">
          Last updated at {lastUpdatedText} ({dataSource})
        </p>
      )}
      {error && effectiveData && (
        <p className="text-xs text-yellow-500">News refresh failed temporarily. Showing cached articles.</p>
      )}
      {newsItems.map((news) => (
        <div
          key={news.id}
          className={`rounded-lg border p-4 shadow-lg ${isDark ? "border-[#262739] bg-[#0a0a1a]" : "border-gray-300 bg-white"}`}
        >
          <div className="flex items-start space-x-3">
            <Megaphone className="h-5 w-5 text-yellow-500" />
            <div className={`text-sm font-bold leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              {news.title}
              <p className={`mt-1 text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {news.source} ·{" "}
                {new Date(news.published_on * 1000).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
