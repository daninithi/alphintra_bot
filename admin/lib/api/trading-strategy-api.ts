// Trading Service API Client - Strategy Management
import axios from 'axios';
import { getToken } from '../auth';

const TRADING_SERVICE_URL = process.env.NEXT_PUBLIC_TRADING_SERVICE_URL || 'http://localhost:8001';

// Types
export interface Strategy {
  strategy_id: string;
  name: string;
  description: string;
  type: 'default' | 'marketplace' | 'user_created';
  access_type?: string;
  python_class?: string;
  python_module?: string;
  strategy_file?: string;
  parameters?: any;
  price: number;
  author_id?: number;
  total_purchases: number;
  created_at?: string;
  updated_at?: string;
}

export interface UploadStrategyData {
  name: string;
  description: string;
  price: number;
  file: File;
}

export interface UpdateStrategyData {
  name?: string;
  description?: string;
  price?: number;
}

class TradingStrategyAPI {
  private getHeaders() {
    const token = getToken();
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  private getMultipartHeaders() {
    const token = getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    };
  }

  /**
   * Upload a new strategy
   */
  async uploadStrategy(data: UploadStrategyData): Promise<Strategy> {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description);
    formData.append('price', data.price.toString());
    formData.append('file', data.file);

    const response = await axios.post(
      `${TRADING_SERVICE_URL}/api/admin/strategies/upload`,
      formData,
      { headers: this.getMultipartHeaders() }
    );

    return response.data.data;
  }

  /**
   * Get all strategies (admin view)
   */
  async getStrategies(type?: string): Promise<Strategy[]> {
    const params = type ? { strategy_type: type } : {};
    const response = await axios.get(
      `${TRADING_SERVICE_URL}/api/admin/strategies`,
      { 
        headers: this.getHeaders(),
        params 
      }
    );

    return response.data.data;
  }

  /**
   * Update strategy metadata
   */
  async updateStrategy(strategyId: string, data: UpdateStrategyData): Promise<void> {
    await axios.put(
      `${TRADING_SERVICE_URL}/api/admin/strategies/${strategyId}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(strategyId: string): Promise<void> {
    await axios.delete(
      `${TRADING_SERVICE_URL}/api/admin/strategies/${strategyId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get strategy file content
   */
  async getStrategyContent(strategyId: string): Promise<string> {
    const response = await axios.get(
      `${TRADING_SERVICE_URL}/api/admin/strategies/${strategyId}/content`,
      { headers: this.getHeaders() }
    );

    return response.data.data.content;
  }
}

export const tradingStrategyAPI = new TradingStrategyAPI();
