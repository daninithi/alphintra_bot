// file path: "D:\Alphintra\Alphintra\src\frontend\lib\api\auth-service-api.ts"

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
  date_of_birth?: string;
  phone_number?: string;
  address?: string;
  kyc_status: string;
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

// Backend raw response format
interface BackendAuthResponse {
  token: string;
  userId: number;
  username: string;
  email: string;
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
  message?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
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
      // Don't attach token to public auth endpoints (login/register)
      const publicPaths = ['/auth/f/login', '/auth/f/register', '/auth/admin/f/login'];
      const isPublic = publicPaths.some(p => config.url?.includes(p));
      if (!isPublic) {
        const token = getToken();
        if (token) {
          config.headers = config.headers ?? {};
          if (!config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
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
      console.log('[AuthAPI] Attempting login to:', this.api.defaults.baseURL + '/auth/f/login');
      console.log('[AuthAPI] Credentials:', { email: credentials.email, passwordLength: credentials.password?.length });
      const response = await this.api.post<BackendAuthResponse>('/auth/f/login', credentials);
      const backendData = response.data;
      console.log('[AuthAPI] Login raw response:', backendData);
      
      // Transform backend response to expected AuthResponse format
      const authResponse: AuthResponse = {
        token: backendData.token,
        user: {
          id: backendData.userId,
          username: backendData.username,
          email: backendData.email,
          kyc_status: 'NOT_STARTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };
      
      console.log('[AuthAPI] Login response transformed:', { hasToken: !!authResponse.token, hasUser: !!authResponse.user });
      return authResponse;
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
      console.log('[AuthAPI] Attempting register to:', this.api.defaults.baseURL + '/auth/f/register');
      // Only send username, email, password
      const payload = {
        username: credentials.username,
        email: credentials.email,
        password: credentials.password,
      };
      const response = await this.api.post<BackendAuthResponse>('/auth/f/register', payload);
      const backendData = response.data;
      console.log('[AuthAPI] Register raw response:', backendData);

      // Validate the expected fields are present
      if (!backendData.token) {
        console.error('[AuthAPI] Register response missing token:', backendData);
        throw new Error('Invalid response from server - missing token');
      }

      // Transform backend response to expected AuthResponse format
      const authResponse: AuthResponse = {
        token: backendData.token,
        user: {
          id: backendData.userId,
          username: backendData.username,
          email: backendData.email,
          kyc_status: 'NOT_STARTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      console.log('[AuthAPI] Register response transformed:', { hasToken: !!authResponse.token, hasUser: !!authResponse.user, userId: authResponse.user.id });
      return authResponse;
    } catch (error: any) {
      console.error('[AuthAPI] Register error:', {
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
    const response = await this.api.put<ChangePasswordResponse>('/auth/users/password', request);
    return response.data;
  }

  async deleteAccount(request: DeleteAccountRequest): Promise<DeleteAccountResponse> {
    // Use axios with DELETE + body (passing data via config)
    const response = await this.api({
      method: 'DELETE',
      url: '/auth/users/account',
      data: request
    });
    return response.data as DeleteAccountResponse;
  }
}

export const authServiceApiClient = new AuthServiceApiClient();
