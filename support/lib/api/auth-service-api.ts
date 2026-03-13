// file path: "support/lib/api/auth-service-api.ts"

import axios from 'axios';
import { gatewayHttpBaseUrl } from '../config/gateway';
import { getToken } from '../auth';


// Types for Auth API
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface SupportLoginCredentials {
  username: string;
  password: string;
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

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export interface UpdateUsernameRequest {
  username: string;
}

export interface UpdateUsernameResponse {
  message: string;
  username: string;
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

  async supportLogin(credentials: SupportLoginCredentials): Promise<AuthResponse> {
    try {
      console.log('[AuthAPI] Attempting support login to:', this.api.defaults.baseURL + '/auth/f/support/login');
      console.log('[AuthAPI] Credentials:', { username: credentials.username, passwordLength: credentials.password?.length });
      const response = await this.api.post('/auth/f/support/login', credentials);
      const data = response.data;
      
      console.log('[AuthAPI] Support login raw response:', data);
      
      // Transform backend response to expected format
      if (data && data.user) {
        data.user = {
          ...data.user,
          created_at: data.user.created_at || new Date().toISOString(),
          updated_at: data.user.updated_at || new Date().toISOString()
        };
      }
      
      console.log('[AuthAPI] Support login response transformed:', { 
        hasToken: !!data?.token, 
        hasUser: !!data?.user, 
        username: data?.user?.username 
      });
      return data;
    } catch (error: any) {
      console.error('[AuthAPI] Support login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        baseURL: this.api.defaults.baseURL
      });
      throw error;
    }
  }

  async changePassword(request: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    const response = await this.api.put<ChangePasswordResponse>('/auth/f/support/password', request);
    return response.data;
  }

  async updateUsername(request: UpdateUsernameRequest): Promise<UpdateUsernameResponse> {
    const response = await this.api.put<UpdateUsernameResponse>('/auth/f/support/username', request);
    return response.data;
  }
}

export const authServiceApiClient = new AuthServiceApiClient();
