'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import axios from 'axios';
import { X, Eye, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  assigneeId: number | null;
  assignedAgentName: string | null;
  assignedAgentEmail: string | null;
  errorLogs: string | null;
  tags: string[];
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

interface UpdateTicketData {
  status?: string;
  priority?: string;
  responseNote?: string;
}

const STATUS_COLORS = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  ASSIGNED: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
  IN_PROGRESS: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/30',
  RESOLVED: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30',
  CLOSED: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/30',
  REOPENED: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30'
};

const PRIORITY_COLORS = {
  LOW: 'bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  MEDIUM: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  HIGH: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  URGENT: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
};

export default function SupportTicketingPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateData, setUpdateData] = useState<UpdateTicketData>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('alphintra_auth_token');
      if (!user || !token) return;

      const response = await axios.get(`http://localhost:8790/ticketing/tickets`, {
        params: {
          assigneeId: user.id
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data && response.data.content) {
        setTickets(response.data.content);
      }
    } catch (error: any) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const openTicketModal = async (ticketId: number) => {
    try {
      const token = localStorage.getItem('alphintra_auth_token');
      const response = await axios.get(`http://localhost:8790/ticketing/tickets/${ticketId}`, {
        params: { agentView: true },
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setSelectedTicket(response.data);
      setUpdateData({
        status: response.data.status,
        priority: response.data.priority
      });
      setShowModal(true);
    } catch (error) {
      console.error('Failed to fetch ticket details:', error);
    }
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;
    
    setUpdating(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('alphintra_auth_token');
      await axios.put(
        `http://localhost:8790/ticketing/tickets/${selectedTicket.id}`,
        updateData,
        {
          params: { agentView: true },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setMessage({ type: 'success', text: 'Ticket updated successfully' });
      fetchTickets();
      
      setTimeout(() => {
        setShowModal(false);
        setSelectedTicket(null);
        setUpdateData({});
      }, 1500);
    } catch (error: any) {
      console.error('Failed to update ticket:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to update ticket' 
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!selectedTicket) return;
    
    setUpdating(true);
    try {
      const token = localStorage.getItem('alphintra_auth_token');
      await axios.put(
        `http://localhost:8790/ticketing/tickets/${selectedTicket.id}/resolve`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: 'Ticket resolved successfully' });
      fetchTickets();
      setTimeout(() => {
        setShowModal(false);
        setSelectedTicket(null);
      }, 1500);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to resolve ticket' });
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredTickets = filterStatus 
    ? tickets.filter(t => t.status === filterStatus)
    : tickets;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-foreground text-xl">Loading tickets...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Assigned Tickets</h1>
          <p className="text-muted-foreground">View and manage your assigned support tickets</p>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Status</option>
          <option value="NEW">New</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total</p>
              <p className="text-2xl font-bold text-foreground">{tickets.length}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-500 dark:text-blue-400" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {tickets.filter(t => t.status === 'IN_PROGRESS').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500 dark:text-yellow-400" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Resolved</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {tickets.filter(t => t.status === 'RESOLVED').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">New</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {tickets.filter(t => t.status === 'NEW' || t.status === 'ASSIGNED').length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-blue-500 dark:text-blue-400" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-semibold text-foreground">ID</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Title</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Priority</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Created</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    className="border-t border-border hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-foreground">{ticket.id}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-1">{ticket.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-foreground">{ticket.customerName || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{ticket.customerEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[ticket.status]}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openTicketModal(ticket.id)}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 hover:bg-muted/40 transition-colors text-foreground"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedTicket && (
        <div className="fixed inset-0 -top-10 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border max-w-4xl w-full max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Header */}
              <div className="flex-shrink-0 bg-card border-b border-border px-6 py-5 flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-foreground">Ticket {selectedTicket.id}</h2>
                  <p className="text-muted-foreground text-sm mt-1">{selectedTicket.title}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-muted/40 rounded-lg transition-colors ml-4 flex-shrink-0"
                >
                  <X className="w-6 h-6 text-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-card">
              {message && (
                <div
                  className={`p-4 rounded-lg text-sm font-medium border ${
                    message.type === 'success'
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-200 dark:border-green-400/50'
                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-200 dark:border-red-400/50'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/40 rounded-lg p-4 border border-border">
                  <p className="text-muted-foreground text-sm mb-1">Customer</p>
                  <p className="text-foreground font-medium">{selectedTicket.customerName || 'N/A'}</p>
                  <p className="text-muted-foreground text-sm">{selectedTicket.customerEmail}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-4 border border-border">
                  <p className="text-muted-foreground text-sm mb-1">Category</p>
                  <p className="text-foreground font-medium">{selectedTicket.category?.replace('_', ' ')}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-4 border border-border">
                  <p className="text-muted-foreground text-sm mb-1">Created</p>
                  <p className="text-foreground font-medium">{formatDate(selectedTicket.createdAt)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-4 border border-border">
                  <p className="text-muted-foreground text-sm mb-1">Last Updated</p>
                  <p className="text-foreground font-medium">{formatDate(selectedTicket.updatedAt)}</p>
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-4 border border-border">
                <p className="text-muted-foreground text-sm mb-2">Description</p>
                <p className="text-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {selectedTicket.errorLogs && (
                <div className="bg-muted/40 rounded-lg p-4 border border-border">
                  <p className="text-muted-foreground text-sm mb-2">Error Logs</p>
                  <pre className="text-red-600 dark:text-red-400/90 text-xs bg-red-50 dark:bg-red-500/10 p-3 rounded overflow-x-auto border border-red-200 dark:border-red-500/30">
                    {selectedTicket.errorLogs}
                  </pre>
                </div>
              )}

              <div className="bg-muted/40 rounded-lg p-4 border border-border space-y-4">
                <h3 className="text-foreground font-semibold text-lg">Update Ticket</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-muted-foreground text-sm mb-2">Status</label>
                    <select
                      value={updateData.status || selectedTicket.status}
                      onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                      className="w-full bg-background text-foreground px-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="NEW">New</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                      <option value="REOPENED">Reopened</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-muted-foreground text-sm mb-2">Priority</label>
                    <select
                      value={updateData.priority || selectedTicket.priority}
                      onChange={(e) => setUpdateData({ ...updateData, priority: e.target.value })}
                      className="w-full bg-background text-foreground px-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleUpdateTicket}
                  disabled={updating}
                  className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-all disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : 'Update Ticket'}
                </button>
                
                {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={handleResolveTicket}
                    disabled={updating}
                    className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-500/20 dark:hover:bg-green-500/30 dark:text-green-400 dark:border-2 dark:border-green-500/40 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updating ? 'Resolving...' : 'Mark as Resolved'}
                  </button>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
