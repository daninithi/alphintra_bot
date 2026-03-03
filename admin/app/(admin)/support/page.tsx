'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { sendSupportCredentials } from '@/lib/email/supportEmail';

interface SupportMember {
  id: number;
  username: string;
  email: string;
  active: boolean;
  createdAt: string;
  assignedCategory: string | null;
  specializationLevel: 'JUNIOR' | 'MID' | 'SENIOR';
  maxTickets: number;
  currentTicketCount: number;
}

interface Credentials {
  username: string;
  password: string;
  email: string;
}

const TICKET_CATEGORIES = [
  'TECHNICAL',
  'BUG_REPORT',
  'STRATEGY_DEVELOPMENT',
  'LIVE_TRADING',
  'BROKER_INTEGRATION',
  'ACCOUNT_BILLING',
  'MARKETPLACE',
  'SECURITY',
  'DATA_PRIVACY',
  'FEATURE_REQUEST',
  'GENERAL_INQUIRY'
];

const formatCategory = (category: string): string => {
  return category.split('_').map(word => 
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join(' ');
};

export default function SupportPage() {
  const [members, setMembers] = useState<SupportMember[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SupportMember | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [specializationLevel, setSpecializationLevel] = useState<'JUNIOR' | 'MID' | 'SENIOR'>('MID');
  const [maxTickets, setMaxTickets] = useState<number>(10);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('alphintra_auth_token');
      const response = await axios.get('http://localhost:8790/auth/admin/support/all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.data.success) {
        setMembers(response.data.members);
      }
    } catch (err: any) {
      console.error('Failed to fetch members:', err);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('alphintra_auth_token');
      const response = await axios.post(
        'http://localhost:8790/auth/admin/support/create',
        { email },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        const { credentials: creds } = response.data;
        
        setCredentials({
          username: creds.username,
          password: creds.password,
          email: email
        });
        
        setShowEmailModal(false);
        setShowCredentialsModal(true);
        setEmail('');
        fetchMembers();
        
        // Send credentials via email using EmailJS in background
        try {
          await sendSupportCredentials(
            email,
            creds.username,
            creds.password
          );
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }
      } else {
        setError(response.data.message || 'Failed to create support member');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDeleteMember = async (id: number, username: string) => {
    if (!confirm(`Are you sure you want to delete support member "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('alphintra_auth_token');
      await axios.delete(
        `http://localhost:8790/auth/admin/support/delete/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      fetchMembers();
    } catch (err: any) {
      console.error('Failed to delete member:', err);
      alert('Failed to delete member: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('alphintra_auth_token');
      const endpoint = currentStatus ? 'deactivate' : 'activate';
      
      await axios.put(
        `http://localhost:8790/auth/admin/support/${endpoint}/${id}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      fetchMembers();
    } catch (err: any) {
      console.error('Failed to toggle member status:', err);
    }
  };

  const handleOpenManageModal = (member: SupportMember) => {
    setSelectedMember(member);
    setSelectedCategory(member.assignedCategory || null);
    setSpecializationLevel(member.specializationLevel || 'MID');
    setMaxTickets(member.maxTickets || 10);
    setShowManageModal(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedMember) return;

    try {
      const token = localStorage.getItem('alphintra_auth_token');

      // Update category
      if (selectedCategory) {
        await axios.post(
          `http://localhost:8790/auth/admin/support/assign-category/${selectedMember.id}?category=${selectedCategory}`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
      }

      // Update specialization level
      await axios.put(
        `http://localhost:8790/auth/admin/support/specialization/${selectedMember.id}?level=${specializationLevel}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Update max tickets
      await axios.put(
        `http://localhost:8790/auth/admin/support/max-tickets/${selectedMember.id}?maxTickets=${maxTickets}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      setShowManageModal(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      alert('Failed to update settings: ' + (err.response?.data?.message || err.message));
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategory(prev => prev === category ? null : category);
  };

  return (
    <div className="max-w-full">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-foreground">Support Team Management</h1>
        <button
          onClick={() => setShowEmailModal(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2 shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Support Member
        </button>
      </div>

      {/* Email Input Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Create New Support Member</h2>
            <form onSubmit={handleCreateMember} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
                  placeholder="support@example.com"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmail('');
                    setError('');
                  }}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-foreground font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Display Modal */}
      {showCredentialsModal && credentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-foreground">Support Member Created!</h2>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Credentials have been sent to <span className="font-medium text-foreground">{credentials.email}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Username
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={credentials.username}
                    readOnly
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(credentials.username, 'username')}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-foreground rounded-lg transition-colors"
                  >
                    {copiedField === 'username' ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Password
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={credentials.password}
                    readOnly
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(credentials.password, 'password')}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-foreground rounded-lg transition-colors"
                  >
                    {copiedField === 'password' ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setCredentials(null);
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Settings Modal */}
      {showManageModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Manage {selectedMember.username}
            </h2>

            <div className="space-y-6">
              {/* Specialization Level */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Specialization Level
                </label>
                <select
                  value={specializationLevel}
                  onChange={(e) => setSpecializationLevel(e.target.value as 'JUNIOR' | 'MID' | 'SENIOR')}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-foreground"
                >
                  <option value="JUNIOR">Junior</option>
                  <option value="MID">Mid-Level</option>
                  <option value="SENIOR">Senior</option>
                </select>
              </div>

              {/* Max Tickets */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Maximum Concurrent Tickets
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxTickets}
                  onChange={(e) => setMaxTickets(parseInt(e.target.value) || 10)}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-foreground"
                />
              </div>

              {/* Assigned Category */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Assigned Category (Select One)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-3 bg-background border border-border rounded-lg">
                  {TICKET_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                        selectedCategory === category
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
                          : 'bg-card hover:bg-muted/30 border border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        checked={selectedCategory === category}
                        onChange={() => toggleCategory(category)}
                        className="w-4 h-4 text-yellow-600 bg-background border-gray-300 focus:ring-yellow-500"
                      />
                      <span className="text-sm text-foreground">
                        {formatCategory(category)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowManageModal(false);
                  setSelectedMember(null);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-foreground font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Members List */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden max-w-full">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Support Team Members</h2>
        </div>

        {members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No support members yet. Create one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
            <table className="w-full min-w-[800px]">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider bg-muted/50">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider bg-muted/50">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider bg-muted/50">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider bg-muted/50">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider bg-muted/50">
                    Workload
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider bg-muted/50">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider bg-muted/50">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider bg-muted/50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {member.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {member.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex items-center justify-center text-xs leading-5 font-semibold rounded-full min-w-[70px] ${
                          member.specializationLevel === 'SENIOR'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : member.specializationLevel === 'MID'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}
                      >
                        {member.specializationLevel || 'MID'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {member.assignedCategory ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs rounded-md">
                          {formatCategory(member.assignedCategory)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No category</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                          <div
                            className={`h-2 rounded-full ${
                              (member.currentTicketCount || 0) >= (member.maxTickets || 10)
                                ? 'bg-red-500'
                                : (member.currentTicketCount || 0) >= (member.maxTickets || 10) * 0.7
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{
                              width: `${Math.min(100, ((member.currentTicketCount || 0) / (member.maxTickets || 10)) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium min-w-[45px]">
                          {member.currentTicketCount || 0}/{member.maxTickets || 10}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex items-center justify-center gap-1 text-xs leading-5 font-semibold rounded-full min-w-[90px] ${
                          member.active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {member.active ? (
                          <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Active
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Inactive
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => handleOpenManageModal(member)}
                          className="px-3 py-1 rounded-md font-medium transition-colors min-w-[80px] bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
                          title="Manage settings"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => handleToggleActive(member.id, member.active)}
                          className={`px-3 py-1 rounded-md font-medium transition-colors min-w-[100px] ${
                            member.active
                              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                          }`}
                        >
                          {member.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id, member.username)}
                          className="p-2 rounded-md transition-colors bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                          title="Delete member"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
