// file path: "admin/lib/api/auth-service-api.ts"

import axios from 'axios';
import { gatewayHttpBaseUrl } from '../config/gateway';
import { getToken } from '../auth';


// Types for Auth API
export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface GoogleLoginCredentials {
  google_token: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
}

export interface DeleteAccountRequest {
  email: string;
  password: string;
}

export interface DeleteAccountResponse {
  message: string;
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export interface AdminManagedUser {
  id: number;
  name: string;
  email: string;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  createdDate: string;
}

export interface UserStrategyInfo {
  strategy_id: string;
  name: string;
  type: string;
  access_type: string;
  bot_status: string;
  last_run?: string;
}

export interface LoginHistoryRecord {
  id: string | number;
  loginAt: string;
}

export class AuthServiceApiClient {
  private api: ReturnType<typeof axios.create>;

  constructor() {
    this.api = axios.create({
      baseURL: gatewayHttpBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use((config) => {
      const token = getToken();
      if (token) {
        config.headers = config.headers ?? {};
        if (!config.headers['Authorization']) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
      return config;
    });

    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_API === 'true') {
      console.log('🔧 AuthServiceApiClient Debug:', {
        baseUrl: this.api.defaults.baseURL,
      });
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      console.log('[AuthAPI] Attempting admin login to:', this.api.defaults.baseURL + '/auth/admin/f/login');
      console.log('[AuthAPI] Credentials:', { email: credentials.email, passwordLength: credentials.password?.length });
      const response = await this.api.post('/auth/admin/f/login', credentials);
      const data = response.data;
      
      console.log('[AuthAPI] Login raw response:', data);
      
      // Transform backend response to expected format
      if (data && !data.user && data.userId) {
        data.user = {
          id: data.userId,
          username: data.username,
          email: data.email,
          kyc_status: 'NOT_STARTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      console.log('[AuthAPI] Login response transformed:', { 
        hasToken: !!data?.token, 
        hasUser: !!data?.user, 
        username: data?.username,
        userUsername: data?.user?.username 
      });
      return data;
    } catch (error: any) {
      console.error('[AuthAPI] Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        baseURL: this.api.defaults.baseURL
      });
      throw error;
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      // Only send username, email, password
      const payload = {
        username: credentials.username,
        email: credentials.email,
        password: credentials.password,
      };
      console.log('[AuthAPI] Attempting admin registration:', { email: payload.email, username: payload.username });
      const response = await this.api.post('/auth/admin/f/register', payload);
      const data = response.data;
      
      console.log('[AuthAPI] Registration response:', data);
      
      // Transform backend response to expected format
      if (data && !data.user && data.userId) {
        data.user = {
          id: data.userId,
          username: data.username,
          email: data.email,
          kyc_status: 'NOT_STARTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      return data;
    } catch (error: any) {
      console.error('[AuthAPI] Registration error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // Re-throw with backend error message if available
      if (error.response?.data?.error) {
        const backendError = new Error(error.response.data.error);
        (backendError as any).response = error.response;
        throw backendError;
      }
      throw error;
    }
  }

  async checkAdminExists(): Promise<boolean> {
    try {
      const response = await this.api.get<{ exists: boolean }>('/auth/admin/f/exists');
      return response.data.exists;
    } catch (error) {
      console.error('[AuthAPI] Error checking admin existence:', error);
      return false;
    }
  }

  async changePassword(request: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    const response = await this.api.put<ChangePasswordResponse>('/auth/admin/password', request);
    return response.data;
  }

  async deleteAccount(request: DeleteAccountRequest): Promise<DeleteAccountResponse> {
    const response = await this.api.request<DeleteAccountResponse>({
      method: 'DELETE',
      url: '/auth/admin/account',
      data: request
    });
    return response.data;
  }

  async getManagedUsers(): Promise<AdminManagedUser[]> {
    const response = await this.api.get<AdminManagedUser[]>('/auth/admin/users');
    return response.data;
  }

  async getManagedUserById(userId: number): Promise<AdminManagedUser> {
    const response = await this.api.get<AdminManagedUser>(`/auth/admin/users/${userId}`);
    return response.data;
  }

  async suspendManagedUser(userId: number): Promise<AdminManagedUser> {
    const response = await this.api.put<AdminManagedUser>(`/auth/admin/users/${userId}/suspend`);
    return response.data;
  }

  async unsuspendManagedUser(userId: number): Promise<AdminManagedUser> {
    const response = await this.api.put<AdminManagedUser>(`/auth/admin/users/${userId}/unsuspend`);
    return response.data;
  }

  async deleteManagedUser(userId: number): Promise<{ message: string }> {
    const response = await this.api.delete<{ message: string }>(`/auth/admin/users/${userId}`);
    return response.data;
  }

  async getUserStrategies(userId: number): Promise<UserStrategyInfo[]> {
    const response = await this.api.get<UserStrategyInfo[]>(`/trading/strategies/users/${userId}`);
    return response.data;
  }

  async getUserLoginHistory(userId: number): Promise<LoginHistoryRecord[]> {
    const response = await this.api.get<LoginHistoryRecord[]>(`/auth/admin/users/${userId}/login-history`);
    return response.data;
  }
}

export const authServiceApiClient = new AuthServiceApiClient();
