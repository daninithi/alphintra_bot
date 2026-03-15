import axios from "axios";

const MARKETPLACE_BASE_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8790";

export interface MarketplaceStrategyApi {
  id: number;
  strategyId: string;
  name: string;
  description: string;
  type: string;
  pythonClass: string;
  pythonModule: string;
  price: number;
  authorId: number | null;
  totalPurchases: number;
  createdAt: string;
  updatedAt: string;
}

class MarketplaceApi {
  async getMarketplaceStrategies(): Promise<MarketplaceStrategyApi[]> {
    const response = await axios.get(
      `${MARKETPLACE_BASE_URL}/marketplace/strategies`
    );
    return response.data;
  }

  async buyStrategy(strategyId: string, userId: number) {
    const response = await axios.post(
      `${MARKETPLACE_BASE_URL}/marketplace/strategies/${strategyId}/buy`,
      { userId }
    );
    return response.data;
  }

  async getBoughtStrategies(userId: number): Promise<MarketplaceStrategyApi[]> {
    const response = await axios.get(
      `${MARKETPLACE_BASE_URL}/marketplace/library/bought/${userId}`
    );
    return response.data;
  }
}

export const marketplaceApi = new MarketplaceApi();