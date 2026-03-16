'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import axios from 'axios';
import { buildGatewayUrl } from '@/lib/config/gateway';
import { getToken } from '@/lib/auth';

type TicketStatus = 'NEW' | 'IN_PROGRESS'  | 'RESOLVED' | 'CLOSED' | 'REOPENED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority | null;
  category: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  assigneeId: number | null;
  assignedAgentName: string | null;
  assignedAgentEmail: string | null;
  assigned: boolean | null;
  errorLogs: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS: Array<'ALL' | TicketStatus> = [
  'ALL', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED',
];

const formatEnum = (value: string | null | undefined): string => {
  if (!value) return 'Not set';
  return value.split('_').map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(' ');
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
};

const getStatusBadgeClass = (status: TicketStatus): string => {
  switch (status) {
    case 'NEW': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300';
    case 'IN_PROGRESS': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'RESOLVED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'CLOSED': return 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    case 'REOPENED': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    default: return 'bg-muted text-foreground';
  }
};

const getPriorityBadgeClass = (priority: TicketPriority | null): string => {
  switch (priority) {
    case 'URGENT': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    default: return 'bg-muted text-foreground';
  }
};

export default function SupportTicketingPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingTicket, setUpdatingTicket] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const authHeaders = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const filteredTickets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const haystack = [ticket.title, ticket.description, ticket.customerEmail ?? '', ticket.customerName ?? '', String(ticket.id)]
        .join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [searchTerm, tickets]);

  const fetchTickets = async (preferredTicketId?: number | null) => {
    if (!user) return;
    setLoadingList(true);
    setError('');
    try {
      const response = await axios.get(buildGatewayUrl('/ticketing/tickets'), {
        headers: authHeaders(),
        params: {
          page: 0,
          size: 100,
          assigneeId: user.id,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        },
      });
      const nextTickets: Ticket[] = response.data.content ?? [];
      setTickets(nextTickets);
      const nextSelectedId =
        preferredTicketId && nextTickets.some((t) => t.id === preferredTicketId)
          ? preferredTicketId
          : nextTickets[0]?.id ?? null;
      setSelectedTicketId(nextSelectedId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tickets.');
      setTickets([]);
      setSelectedTicketId(null);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchTicketDetail = async (ticketId: number) => {
    setLoadingDetail(true);
    setError('');
    try {
      const response = await axios.get<Ticket>(buildGatewayUrl(`/ticketing/tickets/${ticketId}`), {
        headers: authHeaders(),
        params: { agentView: true },
      });
      setSelectedTicket(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load ticket details.');
      setSelectedTicket(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user, statusFilter]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetail(selectedTicketId);
    } else {
      setSelectedTicket(null);
    }
  }, [selectedTicketId]);

  const refreshSelected = async (ticketId: number) => {
    await Promise.all([fetchTickets(ticketId), fetchTicketDetail(ticketId)]);
  };

  const updateStatus = async (nextStatus: TicketStatus) => {
    if (!selectedTicket) return;
    setUpdatingTicket(true);
    setError('');
    setSuccess('');
    try {
      await axios.put(
        buildGatewayUrl(`/ticketing/tickets/${selectedTicket.id}`),
        { status: nextStatus },
        { headers: { ...authHeaders(), 'Content-Type': 'application/json' }, params: { agentView: true } }
      );
      await refreshSelected(selectedTicket.id);
      setSuccess(`Ticket updated to ${formatEnum(nextStatus)}.`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update ticket status.');
    } finally {
      setUpdatingTicket(false);
    }
  };

  const resolveTicket = async () => {
    if (!selectedTicket) return;
    setUpdatingTicket(true);
    setError('');
    setSuccess('');
    try {
      await axios.put(buildGatewayUrl(`/ticketing/tickets/${selectedTicket.id}/resolve`), {}, { headers: authHeaders() });
      await refreshSelected(selectedTicket.id);
      setSuccess('Ticket marked as resolved.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resolve ticket.');
    } finally {
      setUpdatingTicket(false);
    }
  };

  const reopenTicket = async () => {
    if (!selectedTicket) return;
    setUpdatingTicket(true);
    setError('');
    setSuccess('');
    try {
      await axios.put(buildGatewayUrl(`/ticketing/tickets/${selectedTicket.id}/reopen`), {}, { headers: authHeaders() });
      await refreshSelected(selectedTicket.id);
      setSuccess('Ticket reopened.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reopen ticket.');
    } finally {
      setUpdatingTicket(false);
    }
  };

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Assigned Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">View and manage support tickets assigned to you.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Ticket list panel */}
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4 space-y-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tickets..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | TicketStatus)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt === 'ALL' ? 'All statuses' : formatEnum(opt)}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-muted-foreground">
              Showing {filteredTickets.length} of {tickets.length} tickets
            </div>
          </div>

          <div className="max-h-[75vh] overflow-y-auto">
            {loadingList ? (
              <div className="p-4 text-sm text-muted-foreground">Loading tickets...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No tickets found.</div>
            ) : (
              filteredTickets.map((ticket) => {
                const isActive = ticket.id === selectedTicketId;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full border-b border-border p-4 text-left transition-colors ${isActive ? 'bg-yellow-50 dark:bg-yellow-900/10' : 'hover:bg-muted/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>#{ticket.id}</span>
                          <span className={`rounded-full px-2 py-1 font-medium ${getStatusBadgeClass(ticket.status)}`}>
                            {formatEnum(ticket.status)}
                          </span>
                        </div>
                        <h2 className="mt-2 truncate text-sm font-semibold text-foreground">{ticket.title}</h2>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.description}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${getPriorityBadgeClass(ticket.priority)}`}>
                        {formatEnum(ticket.priority)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground truncate">
                      {ticket.customerEmail || ticket.customerName || 'No customer info'}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Ticket detail panel */}
        <section className="rounded-lg border border-border bg-card shadow-sm">
          {error && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              {success}
            </div>
          )}

          {!selectedTicketId ? (
            <div className="p-8 text-sm text-muted-foreground">Select a ticket to view its details.</div>
          ) : loadingDetail || !selectedTicket ? (
            <div className="p-8 text-sm text-muted-foreground">Loading ticket details...</div>
          ) : (
            <div className="flex max-h-[75vh] flex-col overflow-y-auto">
              <div className="p-5 space-y-5">
                {/* Title & badges */}
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-background p-5">
                  <div>
                    <div className="text-sm text-muted-foreground">Ticket #{selectedTicket.id}</div>
                    <h2 className="mt-1 text-2xl font-semibold text-foreground">{selectedTicket.title}</h2>
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">
                      {selectedTicket.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(selectedTicket.status)}`}>
                      {formatEnum(selectedTicket.status)}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPriorityBadgeClass(selectedTicket.priority)}`}>
                      {formatEnum(selectedTicket.priority)}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                      {formatEnum(selectedTicket.category)}
                    </span>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{selectedTicket.customerName || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground break-all">{selectedTicket.customerEmail || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Created</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{formatDateTime(selectedTicket.createdAt)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{formatDateTime(selectedTicket.updatedAt)}</div>
                  </div>
                </div>

                {/* Error logs */}
                {selectedTicket.errorLogs && (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Error Logs</div>
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">{selectedTicket.errorLogs}</pre>
                  </div>
                )}

                {/* Actions */}
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Ticket Actions</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => updateStatus(e.target.value as TicketStatus)}
                      disabled={updatingTicket}
                      className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {STATUS_OPTIONS.filter((o) => o !== 'ALL').map((opt) => (
                        <option key={opt} value={opt}>{formatEnum(opt)}</option>
                      ))}
                    </select>

                    {selectedTicket.status === 'RESOLVED' ? (
                      <button
                        type="button"
                        onClick={reopenTicket}
                        disabled={updatingTicket}
                        className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingTicket ? 'Working...' : 'Reopen'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={resolveTicket}
                        disabled={updatingTicket || selectedTicket.status === 'CLOSED'}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingTicket ? 'Working...' : 'Mark Solved'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
