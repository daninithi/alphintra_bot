import { BaseApiClient } from './api-client';
import { buildGatewayUrl } from '../config/gateway';

// Create a dedicated API client for customer support service
const supportApiClient = new BaseApiClient({
  baseUrl: buildGatewayUrl('/api/customer-support')
});

// API Types
export interface CreateTicketRequest {
  userId: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  tags?: string[];
  errorLogs?: string;
  attachments?: string[];
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  category?: TicketCategory;
  assigneeId?: number;
  tags?: string[];
  errorLogs?: string;
  attachments?: string[];
}

export interface EscalationRequest {
  targetLevel: AgentLevel;
  reason: string;
  targetDepartment?: string;
  notes?: string;
}

export interface CreateCommunicationRequest {
  content: string;
  isInternal?: boolean;
  attachments?: string[];
}

export interface TicketFilter {
  userId?: string;
  agentId?: string;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedToMe?: boolean;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}

// Enums
export enum TicketCategory {
  TECHNICAL = 'TECHNICAL',
  BUG_REPORT = 'BUG_REPORT',
  STRATEGY_DEVELOPMENT = 'STRATEGY_DEVELOPMENT',
  LIVE_TRADING = 'LIVE_TRADING',
  BROKER_INTEGRATION = 'BROKER_INTEGRATION',
  ACCOUNT_BILLING = 'ACCOUNT_BILLING',
  MARKETPLACE = 'MARKETPLACE',
  SECURITY = 'SECURITY',
  DATA_PRIVACY = 'DATA_PRIVACY',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  GENERAL_INQUIRY = 'GENERAL_INQUIRY',
  OTHER = 'OTHER'
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL'
}

export enum TicketStatus {
  NEW = 'NEW',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED'
}


export enum AgentLevel {
  L1 = 'L1',
  L2 = 'L2',
  L3_SPECIALIST = 'L3_SPECIALIST',
  L4_MANAGER = 'L4_MANAGER'
}

export enum SenderType {
  USER = 'USER',
  AGENT = 'AGENT',
  SYSTEM = 'SYSTEM'
}

// Response Types
export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority?: TicketPriority;
  category: TicketCategory;
  customerId: string;
  errorLogs?: string;
  tags?: string[];
  attachments?: string[];
  assigneeId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Communication {
  communicationId: number;
  ticketId: string;
  senderId: string;
  senderName?: string;
  senderType: SenderType;
  content: string;
  isInternal: boolean;
  attachments?: string[];
  createdAt: string;
  readAt?: string;
  emailMessageId?: string;
  phoneCallDuration?: number;
  videoCallRecordingUrl?: string;
  senderDisplayName?: string;
  typeDisplayName?: string;
  isRead?: boolean;
  formattedCreatedAt?: string;
  formattedDuration?: string;
}

export interface SupportAgent {
  agentId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  agentLevel: AgentLevel;
  status: AgentStatus;
  department?: string;
  specializations: TicketCategory[];
  currentTicketCount: number;
  maxConcurrentTickets: number;
  averageResolutionTimeHours?: number;
  customerSatisfactionRating?: number;
  isActive: boolean;
}

export enum AgentStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  AWAY = 'AWAY',
  BREAK = 'BREAK',
  OFFLINE = 'OFFLINE'
}

export interface TicketStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResolutionTimeHours: number;
  averageSatisfactionRating: number;
  highPriorityTickets: number;
  escalatedTickets: number;
  ticketsByCategory: Record<string, number>;
  ticketsByPriority: Record<string, number>;
  ticketsByStatus: Record<string, number>;
  dailyTicketCreation: Record<string, number>;
}

export interface PaginatedResponse<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      direction: string;
      property: string;
    };
  };
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
}

// API Functions
const SUPPORT_API_BASE = '';

export const customerSupportApi = {
  // Ticket Management
  async createTicket(request: CreateTicketRequest): Promise<Ticket> {
    const response = await supportApiClient.post<Ticket>(`${SUPPORT_API_BASE}/tickets`, request);
    return response;
  },

  async getTickets(_filter: TicketFilter = {}, _page = 0, _size = 20): Promise<PaginatedResponse<Ticket>> {
    // Intentionally call base endpoint without query params or payload
    const response = await supportApiClient.get<PaginatedResponse<Ticket>>(
      `${SUPPORT_API_BASE}/tickets`
    );
    return response;
  },

  async getTicket(ticketId: string): Promise<Ticket> {
    const response = await supportApiClient.get<Ticket>(`${SUPPORT_API_BASE}/tickets/${ticketId}`);
    return response;
  },

  async updateTicket(ticketId: string, request: UpdateTicketRequest): Promise<Ticket> {
    const response = await supportApiClient.put<Ticket>(`${SUPPORT_API_BASE}/tickets/${ticketId}`, request);
    return response;
  },

  async escalateTicket(ticketId: string, request: EscalationRequest): Promise<Ticket> {
    const response = await supportApiClient.post<Ticket>(`${SUPPORT_API_BASE}/tickets/${ticketId}/escalate`, request);
    return response;
  },

  async closeTicket(ticketId: string, reason?: string): Promise<Ticket> {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    const response = await supportApiClient.post<Ticket>(`${SUPPORT_API_BASE}/tickets/${ticketId}/close${params}`);
    return response;
  },

  async addSatisfactionRating(ticketId: string, rating: number, feedback?: string): Promise<Ticket> {
    const params = new URLSearchParams({ rating: rating.toString() });
    if (feedback) params.append('feedback', feedback);
    
    const response = await supportApiClient.post<Ticket>(`${SUPPORT_API_BASE}/tickets/${ticketId}/satisfaction?${params}`);
    return response;
  },

  async getMyTickets(statuses?: TicketStatus[], page = 0, size = 20): Promise<PaginatedResponse<Ticket>> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString()
    });
    
    if (statuses && statuses.length > 0) {
      statuses.forEach(status => params.append('statuses', status));
    }
    
    const response = await supportApiClient.get<PaginatedResponse<Ticket>>(
      `${SUPPORT_API_BASE}/tickets/my-tickets?${params}`
    );
    return response;
  },

  async searchTickets(query: string, page = 0, size = 20): Promise<PaginatedResponse<Ticket>> {
    const params = new URLSearchParams({
      q: query,
      page: page.toString(),
      size: size.toString()
    });
    
    const response = await supportApiClient.get<PaginatedResponse<Ticket>>(
      `${SUPPORT_API_BASE}/tickets/search?${params}`
    );
    return response;
  },

  async getTicketStats(startDate?: string, endDate?: string): Promise<TicketStats> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await supportApiClient.get<TicketStats>(
      `${SUPPORT_API_BASE}/tickets/stats?${params}`
    );
    return response;
  },

  // Communication Management
  async getTicketCommunications(ticketId: string): Promise<Communication[]> {
    const response = await supportApiClient.get<Communication[]>(
      `${SUPPORT_API_BASE}/tickets/${ticketId}/communications`
    );
    return response;
  },

  async addCommunication(ticketId: string, request: CreateCommunicationRequest): Promise<Communication> {
    const response = await supportApiClient.post<Communication>(
      `${SUPPORT_API_BASE}/tickets/${ticketId}/communications`,
      request
    );
    return response;
  },

  async markCommunicationAsRead(communicationId: number): Promise<void> {
    await supportApiClient.post(`${SUPPORT_API_BASE}/communications/${communicationId}/read`);
  },

  // Agent Management
  async getAgents(): Promise<SupportAgent[]> {
    const response = await supportApiClient.get<{ data: SupportAgent[], total: number, message: string }>(`${SUPPORT_API_BASE}/agents`);
    return response.data;
  },

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<SupportAgent> {
    const response = await supportApiClient.put<SupportAgent>(
      `${SUPPORT_API_BASE}/agents/${agentId}/status`,
      { status }
    );
    return response;
  },

  // Metadata
  async getTicketCategories(): Promise<TicketCategory[]> {
    const response = await supportApiClient.get<TicketCategory[]>(
      `${SUPPORT_API_BASE}/tickets/categories`
    );
    return response;
  },

  async getTicketPriorities(): Promise<TicketPriority[]> {
    const response = await supportApiClient.get<TicketPriority[]>(
      `${SUPPORT_API_BASE}/tickets/priorities`
    );
    return response;
  },

  async getTicketStatuses(): Promise<TicketStatus[]> {
    const response = await supportApiClient.get<TicketStatus[]>(
      `${SUPPORT_API_BASE}/tickets/statuses`
    );
    return response;
  }
};

// Utility functions
export const formatPriority = (priority: TicketPriority): string => {
  const priorityMap = {
    [TicketPriority.LOW]: 'Low',
    [TicketPriority.MEDIUM]: 'Medium',
    [TicketPriority.HIGH]: 'High',
    [TicketPriority.URGENT]: 'Urgent',
    [TicketPriority.CRITICAL]: 'Critical'
  };
  return priorityMap[priority] || priority;
};

export const formatStatus = (status: TicketStatus): string => {
  const statusMap = {
    [TicketStatus.NEW]: 'New',
    [TicketStatus.ASSIGNED]: 'Assigned',
    [TicketStatus.IN_PROGRESS]: 'In Progress',
    [TicketStatus.PENDING_USER]: 'Pending User',
    [TicketStatus.PENDING_INTERNAL]: 'Pending Internal',
    [TicketStatus.ESCALATED]: 'Escalated',
    [TicketStatus.RESOLVED]: 'Resolved',
    [TicketStatus.CLOSED]: 'Closed',
    [TicketStatus.REOPENED]: 'Reopened'
  };
  return statusMap[status] || status;
};

export const formatCategory = (category: TicketCategory): string => {
  const categoryMap = {
    [TicketCategory.TECHNICAL]: 'Technical',
    [TicketCategory.BUG_REPORT]: 'Bug Report',
    [TicketCategory.STRATEGY_DEVELOPMENT]: 'Strategy Development',
    [TicketCategory.LIVE_TRADING]: 'Live Trading',
    [TicketCategory.BROKER_INTEGRATION]: 'Broker Integration',
    [TicketCategory.ACCOUNT_BILLING]: 'Account & Billing',
    [TicketCategory.MARKETPLACE]: 'Marketplace',
    [TicketCategory.SECURITY]: 'Security',
    [TicketCategory.DATA_PRIVACY]: 'Data Privacy',
    [TicketCategory.FEATURE_REQUEST]: 'Feature Request',
    [TicketCategory.GENERAL_INQUIRY]: 'General Inquiry',
    [TicketCategory.OTHER]: 'Other'
  };
  return categoryMap[category] || category;
};

export const getPriorityColor = (priority: TicketPriority): string => {
  const colorMap = {
    [TicketPriority.LOW]: 'text-green-600 bg-green-50',
    [TicketPriority.MEDIUM]: 'text-yellow-600 bg-yellow-50',
    [TicketPriority.HIGH]: 'text-orange-600 bg-orange-50',
    [TicketPriority.URGENT]: 'text-red-600 bg-red-50',
    [TicketPriority.CRITICAL]: 'text-red-800 bg-red-100'
  };
  return colorMap[priority] || 'text-gray-600 bg-gray-50';
};

export const getStatusColor = (status: TicketStatus): string => {
  const colorMap = {
    [TicketStatus.NEW]: 'text-blue-600 bg-blue-50',
    [TicketStatus.ASSIGNED]: 'text-purple-600 bg-purple-50',
    [TicketStatus.IN_PROGRESS]: 'text-yellow-600 bg-yellow-50',
    [TicketStatus.PENDING_USER]: 'text-orange-600 bg-orange-50',
    [TicketStatus.PENDING_INTERNAL]: 'text-orange-600 bg-orange-50',
    [TicketStatus.ESCALATED]: 'text-red-600 bg-red-50',
    [TicketStatus.RESOLVED]: 'text-green-600 bg-green-50',
    [TicketStatus.CLOSED]: 'text-gray-600 bg-gray-50',
    [TicketStatus.REOPENED]: 'text-red-600 bg-red-50'
  };
  return colorMap[status] || 'text-gray-600 bg-gray-50';
};

export default customerSupportApi;
