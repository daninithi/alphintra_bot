export interface MarketCoin {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
}

export interface MarketNewsItem {
  id: string;
  title: string;
  published_on: number;
  source: string;
}

export interface CryptoCompareNewsResponse {
  Data: MarketNewsItem[];
}

export interface BitcoinChartPoint {
  time: string;
  price: number;
}
