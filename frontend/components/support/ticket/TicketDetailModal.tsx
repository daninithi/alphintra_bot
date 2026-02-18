'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Clock, 
  User, 
  Calendar, 
  Tag,
  Send,
  Phone,
  Mail,
  Eye,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { 
  customerSupportApi, 
  Ticket, 
  Communication,
  TicketStatus, 
  TicketPriority,
  SenderType,
  CreateCommunicationRequest,
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
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Agent controls
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  useEffect(() => {
    if (isOpen && ticket.ticketId) {
      loadCommunications();
    }
  }, [isOpen, ticket.ticketId]);

  const loadCommunications = async () => {
    setLoading(true);
    try {
      const comms = await customerSupportApi.getTicketCommunications(ticket.ticketId);
      setCommunications(comms);
    } catch (error) {
      console.error('Failed to load communications:', error);
      toast.error('Failed to load ticket communications');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSubmitting(true);
    try {
      const request: CreateCommunicationRequest = {
        content: newMessage.trim(),
        isInternal: isAgentView || false
      };

      const newComm = await customerSupportApi.addCommunication(ticket.ticketId, request);
      setCommunications(prev => [...prev, newComm]);
      setNewMessage('');
      
      // Update ticket status if it's NEW
      if (ticket.status === TicketStatus.NEW && isAgentView) {
        await handleStatusUpdate(TicketStatus.IN_PROGRESS);
      }
      
      toast.success('Message sent successfully');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (newStatus: TicketStatus) => {
    setUpdatingStatus(true);
    try {
      const request: UpdateTicketRequest = { status: newStatus };
      const updatedTicket = await customerSupportApi.updateTicket(ticket.ticketId, request);
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
      const updatedTicket = await customerSupportApi.updateTicket(ticket.ticketId, request);
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
    return format(new Date(dateString), 'MMM d, yyyy at h:mm a');
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
              Ticket #{ticket.ticketId}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(ticket.status)}>
                {formatStatus(ticket.status)}
              </Badge>
              <Badge className={getPriorityColor(ticket.priority)}>
                {formatPriority(ticket.priority)}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-6">
          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Ticket Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {ticket.title}
              </h2>
              <p className="text-gray-600 mb-4">
                {ticket.description}
              </p>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
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
                  <Tag className="w-4 h-4 text-gray-400" />
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

            {/* Communications */}
            <div className="flex-1 overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Communications ({communications.length})
              </h3>
              
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : communications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No communications yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {communications.map((comm) => (
                    <div 
                      key={comm.communicationId} 
                      className={`p-4 rounded-lg border ${
                        comm.senderType === SenderType.AGENT 
                          ? 'bg-blue-50 border-blue-200' 
                          : comm.isInternal
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          <span className="font-medium text-sm">
                            {comm.senderDisplayName || comm.senderName || 'Unknown'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {comm.typeDisplayName || comm.communicationType}
                          </Badge>
                          {comm.isInternal && (
                            <Badge variant="secondary" className="text-xs">
                              Internal
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(comm.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {comm.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="mt-6 pt-4 border-t">
              <form onSubmit={handleSendMessage}>
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    isAgentView 
                      ? "Type your response to the customer..."
                      : "Type your message..."
                  }
                  rows={3}
                  className="mb-3"
                />
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    {isAgentView && "Messages are visible to customers"}
                  </div>
                  <Button type="submit" disabled={isSubmitting || !newMessage.trim()}>
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 space-y-6">
            {/* Ticket Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Ticket Details</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Category:</span>
                  <div className="font-medium">{formatCategory(ticket.category)}</div>
                </div>
                
                <div>
                  <span className="text-gray-500">Created:</span>
                  <div className="font-medium">{formatDateTime(ticket.createdAt)}</div>
                </div>
                
                <div>
                  <span className="text-gray-500">Last Updated:</span>
                  <div className="font-medium">{formatDateTime(ticket.updatedAt)}</div>
                </div>
                
                {ticket.assigneeId && (
                  <div>
                    <span className="text-gray-500">Assigned To:</span>
                    <div className="font-medium">Agent #{ticket.assigneeId}</div>
                  </div>
                )}
                
                {ticket.errorLogs && (
                  <div>
                    <span className="text-gray-500">Error Logs:</span>
                    <div className="font-medium text-xs bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
                      {ticket.errorLogs}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Controls */}
            {canUpdateTicket && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Status</label>
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
                    <label className="text-sm text-gray-500 mb-1 block">Priority</label>
                    <Select
                      value={ticket.priority}
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