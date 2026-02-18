'use client';

import { useState, useRef, FormEvent, useEffect } from 'react';
import { SearchBar } from '@/components/ui/searchBar';
import { Button } from '@/components/ui/button';
import { Plus, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/index';
import TicketTabs from '@/components/ui/user/ticketing/ticketTabs';
import { userTicketSchema } from '@/lib/api/schemas';
import { api, TicketResponse, TicketPriority, TicketStatus } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { Loader2 } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  customer: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'pending' | 'resolved';
  assignee: string;
  created: string;
  updated: string;
  description: string;
  messages: number;
}

interface FormData {
  title: string;
  description: string;
  priority: '' | 'urgent' | 'high' | 'medium' | 'low';
  customer: string;
  assignee: string;
  status: 'open' | 'in-progress' | 'pending' | 'resolved';
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
  const { user, isLoading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: '',
    customer: '',
    assignee: '',
    status: 'pending',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Load user's tickets on component mount
  useEffect(() => {
    if (user) {
      loadUserTickets();
    }
  }, [user]);

  const loadUserTickets = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userTickets = await api.ticketing.getMyTickets();
      const formattedTickets = userTickets.map(mapApiTicketToFrontend);
      setTickets(formattedTickets);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      // Fallback to empty array
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

  const mapPriorityToApi = (priority: string): TicketPriority => {
    switch (priority) {
      case 'urgent': return TicketPriority.URGENT;
      case 'high': return TicketPriority.HIGH;
      case 'medium': return TicketPriority.MEDIUM;
      case 'low': return TicketPriority.LOW;
      default: return TicketPriority.MEDIUM;
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

  const validateForm = (data: FormData): boolean => {
    const result = userTicketSchema.safeParse(data);
    if (!result.success) {
      const newErrors = result.error.flatten().fieldErrors;
      setErrors({
        title: newErrors.title?.[0],
        description: newErrors.description?.[0],
        priority: newErrors.priority?.[0],
      });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleCreateTicket = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (!validateForm(formData)) return;

    try {
      setSubmitting(true);
      const request = {
        title: formData.title,
        description: formData.description,
        priority: mapPriorityToApi(formData.priority),
        customerId: user.id,
        customerEmail: user.email,
        customerName: user.name,
      };

      const newTicket = await api.ticketing.createTicket(request);
      const formattedTicket = mapApiTicketToFrontend(newTicket);
      
      setTickets(prev => [formattedTicket, ...prev]);
      setFormData({
        title: '',
        description: '',
        priority: '',
        customer: '',
        assignee: '',
        status: 'open',
      });
      setOpen(false);
      if (closeButtonRef.current) {
        closeButtonRef.current.click();
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      // You might want to show an error message to the user here
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Please log in to access customer support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-6 pt-0 space-y-6">
        <div className="p-4 pt-0 flex justify-end items-center gap-4 flex-wrap">
          <SearchBar placeholder="Search tickets..." className="w-full sm:w-72" />
          <Dialog
            open={open}
            onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) {
                setFormData({
                  title: '',
                  description: '',
                  priority: '',
                  customer: '',
                  assignee: '',
                  status: 'open',
                });
                setErrors({});
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-yellow-500 hover:bg-yellow-600 hover:scale-105 gap-2">
                <Plus className="h-4 w-4" />
                Create Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Ticket</DialogTitle>
              </DialogHeader>
              <DialogClose
                ref={closeButtonRef}
                className="absolute right-4 top-4 rounded-md p-1 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <X className="h-4 w-4 text-black dark:text-white" />
                <span className="sr-only">Close</span>
              </DialogClose>
              <form onSubmit={handleCreateTicket}>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Title</label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter ticket title"
                      className="mt-1"
                    />
                    {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title}</p>}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter ticket description"
                      className="mt-1"
                      rows={4}
                    />
                    {errors.description && (
                      <p className="text-sm text-red-500 mt-1">{errors.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Priority</label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            priority: value as FormData['priority'],
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.priority && (
                        <p className="text-sm text-red-500 mt-1">{errors.priority}</p>
                      )}
                    </div>

                  </div>

                  <div className="flex justify-end mt-4">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="bg-yellow-500 hover:bg-yellow-600 hover:scale-105 gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {submitting ? 'Creating...' : 'Create Ticket'}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <TicketTabs
          tickets={tickets}
          priorityColors={priorityColors}
          statusColors={statusColors}
          setTickets={setTickets}
        />
      </main>
    </div>
  );
}
