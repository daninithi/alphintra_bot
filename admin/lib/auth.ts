const TOKEN_KEY = 'alphintra_auth_token';
const LEGACY_TOKEN_KEYS = ['alphintra_jwt_token', 'auth_token'];
const USER_KEY = 'alphintra_user';

export interface User {
  id: string;
  email: string;
  username?: string;
  role:'ADMIN' ;
  createdAt: string;
  updatedAt: string;
}

// Token management
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const primary = localStorage.getItem(TOKEN_KEY);
  if (primary) return primary;

  for (const key of LEGACY_TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }

  return null;
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  LEGACY_TOKEN_KEYS.forEach((key) => localStorage.setItem(key, token));
};

export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  LEGACY_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
};

// User management
export const getUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setUser = (user: User): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const removeUser = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
};

// Token expiration check
export const isTokenExpired = (token: string): boolean => {
  try {
    if (token.endsWith('.local-signature')) {
      return true;
    }
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return Date.now() >= exp;
  } catch {
    return true;
  }
};
