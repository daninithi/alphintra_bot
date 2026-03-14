import { marketplaceApi, MarketplaceStrategyApi } from "@/app/api/marketplaceApi";
import { Strategy } from "@/components/marketplace/types";

function mapStrategy(strategy: any): Strategy {
  const priceNumber = Number(strategy.price ?? 0);

  return {
    id: strategy.strategyId,
    strategyId: strategy.strategyId,
    name: strategy.name ?? "Untitled Strategy",
    description: strategy.description ?? "No description provided.",
    creator: strategy.pythonClass || "Alphintra",
    creatorName: strategy.pythonClass || "Alphintra",
    category: strategy.type === "marketplace" ? "Marketplace" : "Default",
    assetType: "Crypto",

    price: priceNumber === 0 ? "free" : String(priceNumber),
    riskLevel: priceNumber > 30 ? "high" : priceNumber > 0 ? "medium" : "low",

    rating: 4.5,
    subscriberCount: strategy.totalPurchases ?? 0,

    performance: {
      totalReturn: 12,
      winRate: 65,
    },

    isVerified: true,

    // 👇 Marketplace image
    thumbnail:
      strategy.type === "marketplace"
        ? "/images/alphintra-strategy.png"
        : "/images/default-strategy.png",

    type: strategy.type ?? "default",
  };
}

export async function fetchStrategies(): Promise<Strategy[]> {
  const rawStrategies = await marketplaceApi.getMarketplaceStrategies();
  return rawStrategies.map(mapStrategy);
}