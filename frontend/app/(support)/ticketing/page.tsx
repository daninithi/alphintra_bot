'use client'

import { useState, useEffect } from 'react';
import { SearchBar } from '@/components/ui/searchBar'
import TicketTabs from '@/components/ui/support/ticketing/ticketTabs'
import { api, TicketResponse, TicketPriority, TicketStatus } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  customer: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'resolved';
  assignee: string;
  created: string;
  updated: string;
  description: string;
  messages: number;
}

const priorityColors = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-yellow-200 text-gray-900',
};

const statusColors = {
  open: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-orange-100 text-orange-800',
  pending: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all tickets on component mount
  useEffect(() => {
    loadAllTickets();
  }, []);

  const loadAllTickets = async () => {
    try {
      setLoading(true);
      const allTickets = await api.ticketing.getAllTickets();
      const formattedTickets = allTickets.map(mapApiTicketToFrontend);
      setTickets(formattedTickets);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const mapApiTicketToFrontend = (apiTicket: TicketResponse): Ticket => ({
    id: apiTicket.id.toString(),
    title: apiTicket.title,
    customer: apiTicket.customerName,
    priority: mapPriorityToFrontend(apiTicket.priority),
    status: mapStatusToFrontend(apiTicket.status),
    assignee: apiTicket.assignee || 'Unassigned',
    created: formatDate(apiTicket.createdAt),
    updated: formatDate(apiTicket.updatedAt),
    description: apiTicket.description,
    messages: apiTicket.messageCount,
  });

  const mapPriorityToFrontend = (priority: TicketPriority): 'urgent' | 'high' | 'medium' | 'low' => {
    switch (priority) {
      case TicketPriority.URGENT: return 'urgent';
      case TicketPriority.HIGH: return 'high';
      case TicketPriority.MEDIUM: return 'medium';
      case TicketPriority.LOW: return 'low';
      default: return 'medium';
    }
  };

  const mapStatusToFrontend = (status: TicketStatus): 'open' | 'in-progress' | 'resolved' => {
    switch (status) {
      case TicketStatus.OPEN: return 'open';
      case TicketStatus.IN_PROGRESS: return 'in-progress';
      case TicketStatus.RESOLVED: return 'resolved';
      case TicketStatus.CLOSED: return 'resolved'; // Map closed to resolved for frontend
      default: return 'open';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 p-6 pt-0 space-y-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-6 pt-0 space-y-6">
        <div className="p-4 pt-0 flex justify-end items-center gap-4 flex-wrap">
          <SearchBar placeholder="Search tickets..." className="w-full sm:w-72" />
        </div>
        <TicketTabs
          tickets={tickets}
          priorityColors={priorityColors}
          statusColors={statusColors}
          setTickets={setTickets}
          onTicketUpdate={loadAllTickets}
        />
      </main>
    </div>
  );
}