'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  User, 
  Calendar, 
  Tag,
} from 'lucide-react';
import { 
  Ticket, 
  TicketStatus, 
  TicketPriority,
  UpdateTicketRequest,
  formatStatus,
  formatPriority,
  formatCategory,
  getStatusColor,
  getPriorityColor
} from '@/lib/api/customer-support-api';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface TicketDetailModalProps {
  ticket: Ticket;
  isOpen: boolean;
  onClose: () => void;
  onTicketUpdated: (ticket: Ticket) => void;
  isAgentView?: boolean;
  agentId?: string;
}

export default function TicketDetailModal({ 
  ticket, 
  isOpen, 
  onClose, 
  onTicketUpdated, 
  isAgentView = false,
  agentId 
}: TicketDetailModalProps) {
  const ticketId = String(ticket.id);
  const ticketPriority = ticket.priority ?? TicketPriority.MEDIUM;
  
  // Agent controls
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  const handleStatusUpdate = async (newStatus: TicketStatus) => {
    setUpdatingStatus(true);
    try {
      const request: UpdateTicketRequest = { status: newStatus };
      const { customerSupportApi } = await import('@/lib/api/customer-support-api');
      const updatedTicket = await customerSupportApi.updateTicket(ticketId, request, isAgentView);
      onTicketUpdated(updatedTicket);
      toast.success('Ticket status updated');
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update ticket status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityUpdate = async (newPriority: TicketPriority) => {
    setUpdatingPriority(true);
    try {
      const request: UpdateTicketRequest = { priority: newPriority };
      const { customerSupportApi } = await import('@/lib/api/customer-support-api');
      const updatedTicket = await customerSupportApi.updateTicket(ticketId, request, isAgentView);
      onTicketUpdated(updatedTicket);
      toast.success('Ticket priority updated');
    } catch (error) {
      console.error('Failed to update priority:', error);
      toast.error('Failed to update ticket priority');
    } finally {
      setUpdatingPriority(false);
    }
  };

  const getRelativeTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
  };

  const canUpdateTicket = isAgentView && agentId && 
    [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED].includes(ticket.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Ticket 
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(ticket.status)}>
                {formatStatus(ticket.status)}
              </Badge>
              <Badge className={getPriorityColor(ticketPriority)}>
                {formatPriority(ticketPriority)}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-6">
          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Ticket Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {ticket.title}
              </h2>
              <p className="text-muted-foreground mb-4">
                {ticket.description}
              </p>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Created {getRelativeTime(ticket.createdAt)}
                </div>
                
                {ticket.assigneeId && (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Assigned to Agent #{ticket.assigneeId}
                  </div>
                )}
              </div>

              {ticket.tags && ticket.tags.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator className="mb-6" />

            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Ticket communication is disabled. You can review ticket details here and use status or priority controls when available.
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 space-y-6">
            {/* Ticket Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Ticket Details</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <div className="font-medium text-foreground">{formatCategory(ticket.category)}</div>
                </div>
                
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <div className="font-medium text-foreground">{formatDateTime(ticket.createdAt)}</div>
                </div>
                
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <div className="font-medium text-foreground">{formatDateTime(ticket.updatedAt)}</div>
                </div>
                
                {ticket.assigneeId && (
                  <div>
                    <span className="text-muted-foreground">Assigned To:</span>
                    <div className="font-medium text-foreground">Agent #{ticket.assigneeId}</div>
                  </div>
                )}
                
                {ticket.errorLogs && (
                  <div>
                    <span className="text-muted-foreground">Error Logs:</span>
                    <div className="font-medium text-xs bg-muted p-2 rounded mt-1 whitespace-pre-wrap text-foreground">
                      {ticket.errorLogs}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Controls */}
            {canUpdateTicket && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground">Quick Actions</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                    <Select
                      value={ticket.status}
                      onValueChange={(value) => handleStatusUpdate(value as TicketStatus)}
                      disabled={updatingStatus}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(TicketStatus)
                          .filter(status => status !== TicketStatus.NEW)
                          .map(status => (
                          <SelectItem key={status} value={status}>
                            {formatStatus(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Priority</label>
                    <Select
                      value={ticketPriority}
                      onValueChange={(value) => handlePriorityUpdate(value as TicketPriority)}
                      disabled={updatingPriority}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(TicketPriority).map(priority => (
                          <SelectItem key={priority} value={priority}>
                            {formatPriority(priority)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}