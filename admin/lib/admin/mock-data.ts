export type AdminUserStatus = 'Active' | 'Suspended' | 'Banned';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  accountStatus: AdminUserStatus;
  createdDate: string;
  lastLogin: string;
  phone: string;
  address: string;
}

export interface TradeRecord {
  tradeId: string;
  buyer: string;
  seller: string;
  price: number;
  timestamp: string;
}

export interface LoginHistoryItem {
  id: string;
  ipAddress: string;
  location: string;
  device: string;
  timestamp: string;
  success: boolean;
}

export const adminUsers: AdminUser[] = [
  {
    id: 1001,
    name: 'Alice Perera',
    email: 'alice.perera@alphintra.com',
    accountStatus: 'Active',
    createdDate: '2025-11-12T10:20:00Z',
    lastLogin: '2026-03-06T08:10:00Z',
    phone: '+94 77 100 2001',
    address: 'Colombo, Sri Lanka',
  },
  {
    id: 1002,
    name: 'Nuwan Silva',
    email: 'nuwan.silva@alphintra.com',
    accountStatus: 'Suspended',
    createdDate: '2025-10-08T09:15:00Z',
    lastLogin: '2026-03-05T14:42:00Z',
    phone: '+94 77 100 2002',
    address: 'Kandy, Sri Lanka',
  },
  {
    id: 1003,
    name: 'Maya Fernando',
    email: 'maya.fernando@alphintra.com',
    accountStatus: 'Banned',
    createdDate: '2025-09-21T16:05:00Z',
    lastLogin: '2026-03-01T21:33:00Z',
    phone: '+94 77 100 2003',
    address: 'Galle, Sri Lanka',
  },
  {
    id: 1004,
    name: 'Dilan Jayasinghe',
    email: 'dilan.j@alphintra.com',
    accountStatus: 'Active',
    createdDate: '2026-01-04T07:50:00Z',
    lastLogin: '2026-03-06T10:04:00Z',
    phone: '+94 77 100 2004',
    address: 'Negombo, Sri Lanka',
  },
  {
    id: 1005,
    name: 'Sachi Wijesinghe',
    email: 'sachi.w@alphintra.com',
    accountStatus: 'Active',
    createdDate: '2026-02-11T12:40:00Z',
    lastLogin: '2026-03-06T09:27:00Z',
    phone: '+94 77 100 2005',
    address: 'Jaffna, Sri Lanka',
  },
];

export const tradeHistory: TradeRecord[] = [
  {
    tradeId: 'TRD-76012',
    buyer: 'alice.perera@alphintra.com',
    seller: 'nuwan.silva@alphintra.com',
    price: 65210.45,
    timestamp: '2026-03-06T10:11:00Z',
  },
  {
    tradeId: 'TRD-76013',
    buyer: 'maya.fernando@alphintra.com',
    seller: 'dilan.j@alphintra.com',
    price: 64880.32,
    timestamp: '2026-03-06T10:12:45Z',
  },
  {
    tradeId: 'TRD-76014',
    buyer: 'sachi.w@alphintra.com',
    seller: 'alice.perera@alphintra.com',
    price: 65002.1,
    timestamp: '2026-03-06T10:14:11Z',
  },
  {
    tradeId: 'TRD-76015',
    buyer: 'dilan.j@alphintra.com',
    seller: 'maya.fernando@alphintra.com',
    price: 64975.25,
    timestamp: '2026-03-06T10:16:03Z',
  },
  {
    tradeId: 'TRD-76016',
    buyer: 'nuwan.silva@alphintra.com',
    seller: 'sachi.w@alphintra.com',
    price: 65120.55,
    timestamp: '2026-03-06T10:19:39Z',
  },
];

export const loginHistoryByUserId: Record<number, LoginHistoryItem[]> = {
  1001: [
    {
      id: 'h-1001-1',
      ipAddress: '175.157.11.20',
      location: 'Colombo',
      device: 'Chrome on Windows',
      timestamp: '2026-03-06T08:10:00Z',
      success: true,
    },
    {
      id: 'h-1001-2',
      ipAddress: '175.157.11.20',
      location: 'Colombo',
      device: 'Chrome on Windows',
      timestamp: '2026-03-05T17:02:00Z',
      success: true,
    },
  ],
  1002: [
    {
      id: 'h-1002-1',
      ipAddress: '103.12.10.40',
      location: 'Kandy',
      device: 'Edge on Windows',
      timestamp: '2026-03-05T14:42:00Z',
      success: true,
    },
  ],
  1003: [
    {
      id: 'h-1003-1',
      ipAddress: '203.94.6.8',
      location: 'Galle',
      device: 'Safari on iPhone',
      timestamp: '2026-03-01T21:33:00Z',
      success: true,
    },
    {
      id: 'h-1003-2',
      ipAddress: '203.94.6.8',
      location: 'Galle',
      device: 'Safari on iPhone',
      timestamp: '2026-02-28T19:05:00Z',
      success: false,
    },
  ],
  1004: [
    {
      id: 'h-1004-1',
      ipAddress: '112.134.23.90',
      location: 'Negombo',
      device: 'Firefox on Linux',
      timestamp: '2026-03-06T10:04:00Z',
      success: true,
    },
  ],
  1005: [
    {
      id: 'h-1005-1',
      ipAddress: '45.113.44.11',
      location: 'Jaffna',
      device: 'Chrome on Android',
      timestamp: '2026-03-06T09:27:00Z',
      success: true,
    },
  ],
};

export const dashboardMetrics = {
  totalUsers: 5234,
  activeUsers24h: 982,
  totalTradesToday: 1786,
  openSupportTickets: 26,
};

export const tradingVolume7Days = [120, 148, 139, 162, 181, 174, 193];
export const newUserRegistrations7Days = [32, 28, 35, 41, 39, 44, 48];
