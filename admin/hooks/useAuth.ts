'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { authServiceApiClient, User as ApiUser } from '@/lib/api/auth-service-api';
import { getToken, setToken, removeToken, getUser, setUser as setUserStorage } from '@/lib/auth';

export interface User {
  id: string;
  email: string;
  username: string;
  roles: string[];
  isActive: boolean;
  lastLogin?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Real authentication hook using authServiceApiClient
export const useAuthHook = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user from localStorage on mount
    const loadUser = async () => {
      try {
        const token = getToken();
        const storedUser = getUser();
        
        if (token && storedUser) {
          // Map stored user to our User interface
          const mappedUser: User = {
            id: storedUser.id,
            email: storedUser.email,
            username: storedUser.email.split('@')[0],
            roles: [storedUser.role || 'ADMIN'],
            isActive: storedUser.isVerified ?? true,
            lastLogin: storedUser.updatedAt
          };
          setUser(mappedUser);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        removeToken();
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authServiceApiClient.login({ email, password });
      
      if (response.token && response.user) {
        // Store token
        setToken(response.token);
        
        // Store user
        const apiUser: any = {
          id: response.user.id.toString(),
          email: response.user.email,
          firstName: response.user.firstName || '',
          lastName: response.user.lastName || '',
          role: 'ADMIN',
          isVerified: true,
          twoFactorEnabled: false,
          createdAt: response.user.created_at,
          updatedAt: response.user.updated_at
        };
        setUserStorage(apiUser);
        
        // Map to local user state
        const mappedUser: User = {
          id: response.user.id.toString(),
          email: response.user.email,
          username: response.user.username,
          roles: ['ADMIN'],
          isActive: true,
          lastLogin: new Date().toISOString()
        };
        setUser(mappedUser);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setUser(null);
    removeToken();
  };

  const refreshUser = async (): Promise<void> => {
    const storedUser = getUser();
    if (storedUser) {
      const mappedUser: User = {
        id: storedUser.id,
        email: storedUser.email,
        username: storedUser.email.split('@')[0],
        roles: [storedUser.role || 'ADMIN'],
        isActive: storedUser.isVerified ?? true,
        lastLogin: storedUser.updatedAt
      };
      setUser(mappedUser);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser
  };
};

export { AuthContext };
