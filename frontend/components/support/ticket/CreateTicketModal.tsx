'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, Bug, HelpCircle, Settings, CreditCard } from 'lucide-react';
import { 
  customerSupportApi, 
  CreateTicketRequest,
  TicketCategory, 
  TicketPriority,
  formatCategory,
  formatPriority
} from '@/lib/api/customer-support-api';
import { getUser, getUserDisplayName, getUserEmail } from '@/lib/auth';
import { sendSupportTicketEmail } from '@/lib/email/support-ticket';
import { toast } from 'react-hot-toast';

const CATEGORY_ICONS = {
  [TicketCategory.TECHNICAL]: Bug,
  [TicketCategory.BUG_REPORT]: Bug,
  [TicketCategory.STRATEGY_DEVELOPMENT]: Settings,
  [TicketCategory.LIVE_TRADING]: AlertTriangle,
  [TicketCategory.BROKER_INTEGRATION]: Settings,
  [TicketCategory.ACCOUNT_BILLING]: CreditCard,
  [TicketCategory.MARKETPLACE]: Settings,
  [TicketCategory.SECURITY]: AlertTriangle,
  [TicketCategory.DATA_PRIVACY]: Settings,
  [TicketCategory.FEATURE_REQUEST]: Plus,
  [TicketCategory.GENERAL_INQUIRY]: HelpCircle,
  [TicketCategory.OTHER]: HelpCircle,
};

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: () => void;
  userId: string;
  userEmail?: string;
}

export default function CreateTicketModal({ 
  isOpen, 
  onClose, 
  onTicketCreated, 
  userId, 
  userEmail 
}: CreateTicketModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '' as TicketCategory | '',
    priority: '' as TicketPriority | '',
    errorLogs: ''
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = getUser();
  const currentUserEmail = getUserEmail();
  const userName = useMemo(() => {
    return getUserDisplayName() || userEmail || currentUserEmail || 'Alphintra User';
  }, [userEmail, currentUserEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim() || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const request: CreateTicketRequest = {
        userId,
        userEmail: userEmail ?? currentUserEmail ?? currentUser?.email,
        userName,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority || undefined,
        tags: tags.length > 0 ? tags : undefined,
        errorLogs: formData.errorLogs || undefined
      };

      const createdTicket = await customerSupportApi.createTicket(request);

      if (createdTicket.notificationRecipientEmail) {
        try {
          await sendSupportTicketEmail({
            toEmail: createdTicket.notificationRecipientEmail,
            toName: createdTicket.notificationRecipientName,
            replyTo: userEmail ?? currentUserEmail ?? currentUser?.email,
            senderName: userName,
            senderEmail: userEmail ?? currentUserEmail ?? currentUser?.email,
            subject: createdTicket.notificationSubject ?? `New support ticket #${createdTicket.id}`,
            ticketId: String(createdTicket.id),
            ticketTitle: formData.title.trim(),
            messageType: 'New Support Ticket',
            message: `${formData.description.trim()}${formData.errorLogs ? `\n\nError Logs:\n${formData.errorLogs}` : ''}`,
          });
        } catch (emailError) {
          console.error('Failed to send support email:', emailError);
          toast.error('Ticket created, but the email notification could not be sent.');
        }
      }
      
      toast.success('Support ticket created successfully');
      onTicketCreated();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error('Failed to create ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '' as TicketCategory | '',
      priority: '' as TicketPriority | '',
      errorLogs: ''
    });
    setTags([]);
    setTagInput('');
  };

  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const getCategoryIcon = (category: TicketCategory) => {
    const IconComponent = CATEGORY_ICONS[category] || HelpCircle;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Create Support Ticket
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-sm font-medium">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief description of your issue"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Please provide detailed information about your issue"
                rows={4}
                className="mt-1 text-foreground placeholder:text-muted-foreground" 
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category" className="text-sm font-medium">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as TicketCategory }))}
                  required
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TicketCategory).map(category => (
                      <SelectItem key={category} value={category}>
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(category)}
                          {formatCategory(category)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority" className="text-sm font-medium">
                  Priority (optional)
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as TicketPriority }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="select priority" />
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
{/* Error Logs */}
          <div>
            <Label htmlFor="errorLogs" className="text-sm font-medium">
              Error Logs or Messages (optional)
            </Label>
            <Textarea
              id="errorLogs"
              value={formData.errorLogs}
              onChange={(e) => setFormData(prev => ({ ...prev, errorLogs: e.target.value }))}
              placeholder="Copy and paste any error messages or logs"
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="text-foreground">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}