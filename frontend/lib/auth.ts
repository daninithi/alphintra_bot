const TOKEN_KEY = 'alphintra_auth_token';
const LEGACY_TOKEN_KEYS = ['alphintra_jwt_token', 'auth_token'];
const USER_KEY = 'alphintra_user';
const LEGACY_USER_KEYS = ['alphintra_jwt_user'];

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN' | 'KYC_ADMIN';
  isVerified: boolean;
  twoFactorEnabled: boolean;
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

  const storedUser = [USER_KEY, ...LEGACY_USER_KEYS]
    .map((key) => localStorage.getItem(key))
    .find(Boolean);

  if (!storedUser) return null;

  try {
    const parsed = JSON.parse(storedUser);
    const token = getToken();

    let tokenEmail: string | undefined;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        tokenEmail = payload?.email;
      } catch {
        tokenEmail = undefined;
      }
    }

    return {
      id: String(parsed?.id ?? parsed?.userId ?? parsed?.sub ?? ''),
      email: parsed?.email ?? parsed?.user?.email ?? tokenEmail ?? '',
      firstName: parsed?.firstName ?? parsed?.first_name ?? parsed?.user?.firstName ?? '',
      lastName: parsed?.lastName ?? parsed?.last_name ?? parsed?.user?.lastName ?? '',
      role: parsed?.role ?? parsed?.user?.role ?? 'USER',
      isVerified: parsed?.isVerified ?? parsed?.emailVerified ?? true,
      twoFactorEnabled: parsed?.twoFactorEnabled ?? false,
      createdAt: parsed?.createdAt ?? parsed?.created_at ?? '',
      updatedAt: parsed?.updatedAt ?? parsed?.updated_at ?? '',
    };
  } catch {
    return null;
  }
};

export const getUserEmail = (): string | null => {
  const user = getUser();
  if (user?.email) {
    return user.email;
  }

  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email ?? null;
  } catch {
    return null;
  }
};

export const getUserDisplayName = (): string | null => {
  const user = getUser();
  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || null;
};

export const setUser = (user: User): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const removeUser = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
};

export const getUserId = (): number | null => {
  if (typeof window === 'undefined') return null;

  const rawUser = localStorage.getItem('alphintra_jwt_user') ?? localStorage.getItem(USER_KEY);
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser);
      const candidate = parsed?.id ?? parsed?.userId ?? parsed?.sub;
      if (typeof candidate === 'string') {
        const asNumber = Number(candidate);
        if (!Number.isNaN(asNumber)) return asNumber;
      } else if (typeof candidate === 'number') {
        return candidate;
      }
    } catch {
      // ignore parsing issues and fall back to decoding the token
    }
  }

  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const candidate = payload?.id ?? payload?.userId ?? payload?.sub;
    if (typeof candidate === 'string') {
      const asNumber = Number(candidate);
      return Number.isNaN(asNumber) ? null : asNumber;
    }
    if (typeof candidate === 'number') {
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
};

// Auth state checks
export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch {
    return true;
  }
};

export const shouldRefreshToken = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    const timeUntilExpiry = payload.exp - currentTime;
    return timeUntilExpiry < 300;
  } catch {
    return false;
  }
};

// Logout utility
export const logout = (): void => {
  removeToken();
  removeUser();
  
  // DEVELOPMENT: Disable automatic redirect to login
  // Uncomment the lines below to re-enable auth redirects for production
  // if (typeof window !== 'undefined') {
  //   window.location.href = '/login';
  // }
};

// Route protection utilities
export const requireAuth = (): boolean => {
  // DEVELOPMENT: Disable authentication requirement
  // Uncomment the lines below to re-enable auth checks for production
  // const token = getToken();
  // 
  // if (!token || isTokenExpired(token)) {
  //   logout();
  //   return false;
  // }
  
  return true; // Always return true for development
};

export const requireRole = (requiredRole: User['role']): boolean => {
  if (!requireAuth()) return false;
  
  const user = getUser();
  if (!user) return false;
  
  const roleHierarchy: Record<User['role'], number> = {
    'USER': 1,
    'KYC_ADMIN': 2,
    'ADMIN': 3,
  };
  
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
};
