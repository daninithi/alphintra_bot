export interface Strategy {
  id: string;
  strategyId: string;
  name: string;
  description: string;
  creator: string;
  category: string;
  assetType: string;
  riskLevel: "Low" | "Medium" | "High";
  rating: number;
  subscriberCount: number;
  price: string;
  performance: {
    totalReturn: number;
    winRate: number;
  };
  verified: boolean;
  type: string;
  authorId?: number;
  publishStatus?: string;
}