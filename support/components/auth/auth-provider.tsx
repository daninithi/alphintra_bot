'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, getToken, getUser, setUser, removeToken, removeUser, isTokenExpired } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,
      login: () => {},
      logout: () => {},
    };
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = Boolean(user && token);

  useEffect(() => {
    const storedToken = getToken();
    const storedUser = getUser();
    if (storedToken && storedUser && !isTokenExpired(storedToken)) {
      setTokenState(storedToken);
      setUserState(storedUser);
    } else {
      removeToken();
      removeUser();
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    import('@/lib/auth').then(({ setToken }) => setToken(newToken));
    setUser(newUser);
    setTokenState(newToken);
    setUserState(newUser);
  };

  const logout = () => {
    setTokenState(null);
    setUserState(null);
    removeToken();
    removeUser();
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
