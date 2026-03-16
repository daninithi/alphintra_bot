import { Strategy } from '@/components/marketplace/types';
import { getToken } from '@/lib/auth';

const MARKETPLACE_API_BASE =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:8790';

const STRATEGIES_API_URL = `${MARKETPLACE_API_BASE}/marketplace/strategies`;

function mapStrategy(strategy: any): Strategy {
  const priceNumber = Number(strategy.price ?? 0);

  return {
    id: strategy.strategyId,
    strategyId: strategy.strategyId,
    name: strategy.name ?? 'Untitled Strategy',
    description: strategy.description ?? 'No description provided.',
    creator: strategy.pythonClass || 'Alphintra',
    creatorName: strategy.pythonClass || 'Alphintra',
    category: strategy.type === 'marketplace' ? 'Marketplace' : 'Default',
    assetType: 'Crypto',

    price: priceNumber === 0 ? 'free' : String(priceNumber),

    riskLevel:
      priceNumber > 50 ? 'high' : priceNumber > 0 ? 'medium' : 'low',

    rating: 4.5,
    reviewCount: 0,
    subscriberCount: strategy.totalPurchases ?? 0,

    performance: {
      totalReturn: 12,
      winRate: 65,
    },

    isVerified: true,

    // neutral UI values instead of colorful cards
    thumbnail: 'default',
    gradientColors: ['#374151', '#1f2937'],

    type: strategy.type ?? 'default',
    authorId: strategy.authorId ?? undefined,
    publishStatus: strategy.publishStatus ?? undefined,
  };
}

export async function fetchStrategies(excludeUserId?: number): Promise<Strategy[]> {
  try {
    const token = getToken();
    const url = excludeUserId
      ? `${STRATEGIES_API_URL}?excludeUserId=${excludeUserId}`
      : STRATEGIES_API_URL;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status: ${response.status}`);
    }

    const restStrategies = await response.json();

    return Array.isArray(restStrategies)
      ? restStrategies.map(mapStrategy)
      : [];
  } catch (error) {
    console.error('API Error in fetchStrategies:', error);
    return [];
  }
}

export async function fetchBoughtStrategies(userId: number): Promise<Strategy[]> {
  try {
    const response = await fetch(
      `${MARKETPLACE_API_BASE}/marketplace/library/bought/${userId}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error(
        `Fetch bought strategies failed with status: ${response.status}`
      );
    }

    const restStrategies = await response.json();

    return Array.isArray(restStrategies)
      ? restStrategies.map(mapStrategy)
      : [];
  } catch (error) {
    console.error('API Error in fetchBoughtStrategies:', error);
    return [];
  }
}

export async function fetchStrategyById(
  id: string | number
): Promise<Strategy | null> {
  const strategies = await fetchStrategies();

  return (
    strategies.find(
      (strategy) =>
        String(strategy.id) === String(id) ||
        String(strategy.strategyId) === String(id)
    ) ?? null
  );
}