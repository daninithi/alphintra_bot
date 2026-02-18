import { BaseApiClient } from './api-client';
import { buildGatewayUrl } from '../config/gateway';

// Create a dedicated API client for ticketing service
const ticketingApiClient = new BaseApiClient({
  baseUrl: buildGatewayUrl('/api/ticketing')
});

// API Types
export interface CreateTicketRequest {
  title: string;
  description: string;
  priority: TicketPriority;
  customerId: string;
  customerEmail: string;
  customerName: string;
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignee?: string;
}

export interface TicketResponse {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  customerId: string;
  customerEmail: string;
  customerName: string;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// Enums matching backend
export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// API Functions
export const ticketingApi = {
  // Create a new ticket
  createTicket: async (request: CreateTicketRequest): Promise<TicketResponse> => {
    return ticketingApiClient.post<TicketResponse>('/tickets', request);
  },

  // Get all tickets
  getAllTickets: async (): Promise<TicketResponse[]> => {
    return ticketingApiClient.get<TicketResponse[]>('/tickets');
  },

  // Get ticket by ID
  getTicketById: async (id: number): Promise<TicketResponse> => {
    return ticketingApiClient.get<TicketResponse>(`/tickets/${id}`);
  },

  // Get tickets by customer
  getTicketsByCustomer: async (customerId: string): Promise<TicketResponse[]> => {
    return ticketingApiClient.get<TicketResponse[]>(`/tickets/customer/${customerId}`);
  },

  // Get my tickets (authenticated user)
  getMyTickets: async (): Promise<TicketResponse[]> => {
    return ticketingApiClient.get<TicketResponse[]>('/tickets/my-tickets');
  },

  // Get tickets by assignee
  getTicketsByAssignee: async (assignee: string): Promise<TicketResponse[]> => {
    return ticketingApiClient.get<TicketResponse[]>(`/tickets/assignee/${assignee}`);
  },

  // Get tickets by status
  getTicketsByStatus: async (status: TicketStatus): Promise<TicketResponse[]> => {
    return ticketingApiClient.get<TicketResponse[]>(`/tickets/status/${status}`);
  },

  // Update ticket
  updateTicket: async (id: number, request: UpdateTicketRequest): Promise<TicketResponse> => {
    return ticketingApiClient.put<TicketResponse>(`/tickets/${id}`, request);
  },

  // Delete ticket
  deleteTicket: async (id: number): Promise<void> => {
    return ticketingApiClient.delete(`/tickets/${id}`);
  },

  // Assign ticket
  assignTicket: async (id: number, assignee: string): Promise<TicketResponse> => {
    return ticketingApiClient.put<TicketResponse>(`/api/tickets/${id}/assign?assignee=${encodeURIComponent(assignee)}`);
  },

  // Resolve ticket
  resolveTicket: async (id: number): Promise<TicketResponse> => {
    return ticketingApiClient.put<TicketResponse>(`/api/tickets/${id}/resolve`);
  },

  // Reopen ticket
  reopenTicket: async (id: number): Promise<TicketResponse> => {
    return ticketingApiClient.put<TicketResponse>(`/api/tickets/${id}/reopen`);
  }
};