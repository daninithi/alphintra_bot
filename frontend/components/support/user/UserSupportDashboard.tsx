'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, Clock, CheckCircle, AlertTriangle, HelpCircle, Zap, ArrowLeft, RefreshCw } from 'lucide-react';
import { 
  customerSupportApi, 
  Ticket, 
  TicketStats,
  TicketPriority,
  TicketStatus,
  formatStatus,
  formatPriority,
  getStatusColor,
  getPriorityColor
} from '@/lib/api/customer-support-api';
import { formatDistanceToNow } from 'date-fns';
import CreateTicketModal from '../ticket/CreateTicketModal';
import TicketList from '../ticket/TicketList';
import { toast } from 'react-hot-toast';

interface UserSupportDashboardProps {
  userId: string;
}

export default function UserSupportDashboard({ userId }: UserSupportDashboardProps) {
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [view, setView] = useState<'dashboard' | 'all-tickets'>('dashboard');

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load recent tickets (last 3)
      const ticketsResponse = await customerSupportApi.getMyTickets(undefined, 0, 3, userId);
      setRecentTickets(ticketsResponse?.content || []);

      // Load user stats
      const statsResponse = await customerSupportApi.getTicketStats(undefined, undefined, userId);
      setStats(statsResponse);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (newView: 'dashboard' | 'all-tickets') => {
    setView(newView);
  };

  const handleTicketCreated = () => {
    loadDashboardData();
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.NEW:
        return <MessageSquare className="w-5 h-5" />;
      case TicketStatus.IN_PROGRESS:
        return <Clock className="w-5 h-5" />;
      case TicketStatus.RESOLVED:
      case TicketStatus.CLOSED:
        return <CheckCircle className="w-5 h-5" />;
      case TicketStatus.ESCALATED:
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {view === 'all-tickets' ? (
        <>
          {/* All Tickets View */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleViewChange('dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">All My Tickets</h1>
            </div>

          </div>
          
          <TicketList userId={userId} />
        </>
      ) : (
        <>
          {/* Dashboard View */}
          {/* Quick Stats */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-8 bg-muted rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalTickets}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold text-foreground">{stats.resolvedTickets}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Resolution</p>
                  <p className="text-2xl font-bold text-foreground">
                    {Math.round(stats.averageResolutionTimeHours)}h
                  </p>
                </div>
                <Zap className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-6 h-6" />
              <span>Create New Ticket</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => handleViewChange('all-tickets')}
            >
              <MessageSquare className="w-6 h-6" />
              <span>View All Tickets</span>
            </Button>
            
          </div>
        </CardContent>
      </Card>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Recent Tickets
            </CardTitle>
          
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse border border-border rounded-lg p-4">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="flex gap-2">
                    <div className="h-6 bg-muted rounded w-16"></div>
                    <div className="h-6 bg-muted rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : !recentTickets || recentTickets.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No tickets yet</h3>
              <p className="text-muted-foreground mb-4">
                You haven't created any support tickets. Get help by creating your first ticket.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTickets.map((ticket) => (
                <div 
                  key={ticket.id} 
                  className="border border-border rounded-lg p-4 hover:shadow-md hover:bg-accent/30 transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(ticket.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {formatStatus(ticket.status)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority ?? TicketPriority.MEDIUM)}`}>
                        {formatPriority(ticket.priority ?? TicketPriority.MEDIUM)}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="font-medium text-foreground mb-1">
                    {ticket.title}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {ticket.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        </>
      )}

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTicketCreated={handleTicketCreated}
        userId={userId}
      />
    </div>
  );
}