'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { buildGatewayUrl } from '@/lib/config/gateway';
import { getToken } from '@/lib/auth';

type TicketStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketCategory =
	| 'TECHNICAL'
	| 'BUG_REPORT'
	| 'STRATEGY_DEVELOPMENT'
	| 'LIVE_TRADING'
	| 'BROKER_INTEGRATION'
	| 'ACCOUNT_BILLING'
	| 'MARKETPLACE'
	| 'SECURITY'
	| 'DATA_PRIVACY'
	| 'FEATURE_REQUEST'
	| 'GENERAL_INQUIRY';

interface Ticket {
	id: number;
	title: string;
	description: string;
	status: TicketStatus;
	priority: TicketPriority | null;
	category: TicketCategory;
	customerId: string;
	customerEmail: string | null;
	customerName: string | null;
	errorLogs: string | null;
	tags: string[] | null;
	assigneeId: number | null;
	assignedAgentName: string | null;
	assignedAgentEmail: string | null;
	communicationCount: number | null;
	customerUnreadCount: number | null;
	agentUnreadCount: number | null;
	hasUnreadMessages: boolean | null;
	lastCommunicationAt: string | null;
	createdAt: string;
	updatedAt: string;
}

interface SupportMember {
	id: number;
	username: string;
	email: string;
	active: boolean;
	assignedCategory: string | null;
	specializationLevel: 'JUNIOR' | 'MID' | 'SENIOR';
	maxTickets: number;
	currentTicketCount: number;
}

interface PagedTicketsResponse {
	content: Ticket[];
}

interface SupportMembersResponse {
	success: boolean;
	members: SupportMember[];
}

interface AdminUserProfile {
	id: number;
	name: string;
	email: string;
	emailVerified?: boolean;
}

interface AdminUserByIdResponse {
	user: AdminUserProfile;
}

type AssignmentFilter = 'ALL' | 'ASSIGNED' | 'UNASSIGNED';

const STATUS_OPTIONS: Array<'ALL' | TicketStatus> = [
	'ALL',
	'NEW',
	'ASSIGNED',
	'IN_PROGRESS',
	'ESCALATED',
	'RESOLVED',
	'CLOSED',
	'REOPENED',
];

const formatEnum = (value: string | null | undefined): string => {
	if (!value) {
		return 'Not set';
	}

	return value
		.split('_')
		.map((part) => part.charAt(0) + part.slice(1).toLowerCase())
		.join(' ');
};

const formatDateTime = (value: string | null | undefined): string => {
	if (!value) {
		return 'Not available';
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'Invalid date';
	}

	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(date);
};

const getStatusBadgeClass = (status: TicketStatus): string => {
	switch (status) {
		case 'NEW':
			return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300';
		case 'ASSIGNED':
			return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
		case 'IN_PROGRESS':
			return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
		case 'ESCALATED':
			return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
		case 'RESOLVED':
			return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
		case 'CLOSED':
			return 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
		default:
			return 'bg-muted text-foreground';
	}
};

const getPriorityBadgeClass = (priority: TicketPriority | null): string => {
	switch (priority) {
		case 'URGENT':
			return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
		case 'HIGH':
			return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
		case 'MEDIUM':
			return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
		case 'LOW':
			return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
		default:
			return 'bg-muted text-foreground';
	}
};

export default function AdminTicketingPage() {
	const [tickets, setTickets] = useState<Ticket[]>([]);
	const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
	const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
	const [supportMembers, setSupportMembers] = useState<SupportMember[]>([]);
	const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
	const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
	const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('ALL');
	const [searchTerm, setSearchTerm] = useState('');
	const [loadingList, setLoadingList] = useState(true);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [loadingMembers, setLoadingMembers] = useState(true);
	const [assigningMember, setAssigningMember] = useState(false);
	const [updatingTicket, setUpdatingTicket] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [resolvedCustomerEmail, setResolvedCustomerEmail] = useState('');

	const displayCustomerEmail = resolvedCustomerEmail || selectedTicket?.customerEmail || 'No email available';

	const authHeaders = () => {
		const token = getToken();
		return token
			? {
					Authorization: `Bearer ${token}`,
				}
			: {};
	};

	const filteredTickets = useMemo(() => {
		const query = searchTerm.trim().toLowerCase();
		return tickets.filter((ticket) => {
			const matchesAssignment =
				assignmentFilter === 'ALL'
					? true
					: assignmentFilter === 'ASSIGNED'
						? Boolean(ticket.assigneeId)
						: !ticket.assigneeId;

			const haystack = [
				ticket.title,
				ticket.description,
				ticket.customerEmail ?? '',
				ticket.customerName ?? '',
				String(ticket.id),
			]
				.join(' ')
				.toLowerCase();

			const matchesQuery = !query || haystack.includes(query);

			return matchesAssignment && matchesQuery;
		});
	}, [assignmentFilter, searchTerm, tickets]);

	const fetchSupportMembers = async () => {
		setLoadingMembers(true);

		try {
			const response = await axios.get<SupportMembersResponse>(buildGatewayUrl('/auth/admin/support/all'), {
				headers: authHeaders(),
			});

			setSupportMembers(response.data.members ?? []);
		} catch (requestError) {
			console.error('Failed to fetch support members:', requestError);
		} finally {
			setLoadingMembers(false);
		}
	};

	const fetchTickets = async (preferredTicketId?: number | null) => {
		setLoadingList(true);
		setError('');

		try {
			const response = await axios.get<PagedTicketsResponse>(buildGatewayUrl('/ticketing/tickets'), {
				headers: authHeaders(),
				params: {
					page: 0,
					size: 100,
					status: statusFilter === 'ALL' ? undefined : statusFilter,
				},
			});

			const nextTickets = response.data.content ?? [];
			setTickets(nextTickets);

			const nextSelectedId =
				preferredTicketId && nextTickets.some((ticket) => ticket.id === preferredTicketId)
					? preferredTicketId
					: nextTickets[0]?.id ?? null;

			setSelectedTicketId(nextSelectedId);
		} catch (requestError: any) {
			console.error('Failed to fetch tickets:', requestError);
			setError(requestError.response?.data?.message || 'Failed to load tickets.');
			setTickets([]);
			setSelectedTicketId(null);
		} finally {
			setLoadingList(false);
		}
	};

	const fetchTicketDetail = async (ticketId: number) => {
		setLoadingDetail(true);
		setError('');
		setResolvedCustomerEmail('');

		try {
			const ticketResponse = await axios.get<Ticket>(buildGatewayUrl(`/ticketing/tickets/${ticketId}`), {
				headers: authHeaders(),
				params: { agentView: true },
			});

			const loadedTicket = ticketResponse.data;
			setSelectedTicket(loadedTicket);
			setSelectedAssigneeId(loadedTicket.assigneeId ? String(loadedTicket.assigneeId) : '');

			if (loadedTicket.customerId) {
				try {
					const userResponse = await axios.get<AdminUserByIdResponse>(
						buildGatewayUrl(`/auth/admin/users/${loadedTicket.customerId}`),
						{ headers: authHeaders() }
					);

					setResolvedCustomerEmail(userResponse.data?.user?.email || '');
				} catch (profileError) {
					console.warn('Failed to resolve customer profile from auth-service:', profileError);
				}
			}
		} catch (requestError: any) {
			console.error('Failed to fetch ticket detail:', requestError);
			setError(requestError.response?.data?.message || 'Failed to load ticket details.');
			setSelectedTicket(null);
			setSelectedAssigneeId('');
			setResolvedCustomerEmail('');
		} finally {
			setLoadingDetail(false);
		}
	};

	useEffect(() => {
		fetchTickets();
		fetchSupportMembers();
	}, [statusFilter]);

	useEffect(() => {
		if (selectedTicketId) {
			fetchTicketDetail(selectedTicketId);
			return;
		}

		setSelectedTicket(null);
		setSelectedAssigneeId('');
		setResolvedCustomerEmail('');
	}, [selectedTicketId]);

	const refreshSelectedTicket = async (ticketId: number) => {
		await Promise.all([fetchTickets(ticketId), fetchTicketDetail(ticketId)]);
	};

	const assignSupportMember = async () => {
		if (!selectedTicket || !selectedAssigneeId) {
			return;
		}

		const selectedMember = supportMembers.find((member) => String(member.id) === selectedAssigneeId);
		if (!selectedMember) {
			setError('Selected support member could not be found.');
			return;
		}

		setAssigningMember(true);
		setError('');
		setSuccess('');

		try {
			await axios.put(
				buildGatewayUrl(`/ticketing/tickets/${selectedTicket.id}`),
				{
					assigneeId: selectedMember.id,
					assigneeName: selectedMember.username,
					assigneeEmail: selectedMember.email,
				},
				{
					headers: {
						...authHeaders(),
						'Content-Type': 'application/json',
					},
					params: { agentView: true },
				}
			);

			await refreshSelectedTicket(selectedTicket.id);
			setSuccess('Support team member assigned successfully.');
		} catch (requestError: any) {
			console.error('Failed to assign support member:', requestError);
			setError(requestError.response?.data?.message || 'Failed to assign support member.');
		} finally {
			setAssigningMember(false);
		}
	};

	const updateStatus = async (nextStatus: TicketStatus) => {
		if (!selectedTicket) {
			return;
		}

		setUpdatingTicket(true);
		setError('');
		setSuccess('');

		try {
			await axios.put(
				buildGatewayUrl(`/ticketing/tickets/${selectedTicket.id}`),
				{ status: nextStatus },
				{
					headers: {
						...authHeaders(),
						'Content-Type': 'application/json',
					},
					params: { agentView: true },
				}
			);

			await refreshSelectedTicket(selectedTicket.id);
			setSuccess(`Ticket updated to ${formatEnum(nextStatus)}.`);
		} catch (requestError: any) {
			console.error('Failed to update ticket:', requestError);
			setError(requestError.response?.data?.message || 'Failed to update ticket status.');
		} finally {
			setUpdatingTicket(false);
		}
	};

	const resolveTicket = async () => {
		if (!selectedTicket) {
			return;
		}

		setUpdatingTicket(true);
		setError('');
		setSuccess('');

		try {
			await axios.put(
				buildGatewayUrl(`/ticketing/tickets/${selectedTicket.id}/resolve`),
				{},
				{
					headers: authHeaders(),
				}
			);

			await refreshSelectedTicket(selectedTicket.id);
			setSuccess('Ticket marked as solved.');
		} catch (requestError: any) {
			console.error('Failed to resolve ticket:', requestError);
			setError(requestError.response?.data?.message || 'Failed to resolve ticket.');
		} finally {
			setUpdatingTicket(false);
		}
	};

	const reopenTicket = async () => {
		if (!selectedTicket) {
			return;
		}

		setUpdatingTicket(true);
		setError('');
		setSuccess('');

		try {
			await axios.put(
				buildGatewayUrl(`/ticketing/tickets/${selectedTicket.id}/reopen`),
				{},
				{
					headers: authHeaders(),
				}
			);

			await refreshSelectedTicket(selectedTicket.id);
			setSuccess('Ticket reopened.');
		} catch (requestError: any) {
			console.error('Failed to reopen ticket:', requestError);
			setError(requestError.response?.data?.message || 'Failed to reopen ticket.');
		} finally {
			setUpdatingTicket(false);
		}
	};

	return (
		<div className="max-w-full space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-foreground">Ticketing</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Track customer tickets, assign support members, and update ticket status.
					</p>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
				<section className="rounded-lg border border-border bg-card shadow-sm">
					<div className="border-b border-border p-4 space-y-3">
						<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
						<input
							type="text"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search by ticket, title, customer"
							className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-500"
						/>

						<select
							value={statusFilter}
							onChange={(event) => setStatusFilter(event.target.value as 'ALL' | TicketStatus)}
							className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-500"
						>
							{STATUS_OPTIONS.map((option) => (
								<option key={option} value={option}>
									{option === 'ALL' ? 'All statuses' : formatEnum(option)}
								</option>
							))}
						</select>
						</div>

						<div className="flex flex-wrap gap-2">
							{(['ALL', 'ASSIGNED', 'UNASSIGNED'] as AssignmentFilter[]).map((option) => {
								const isActive = assignmentFilter === option;
								const label =
									option === 'ALL' ? 'All Tickets' : option === 'ASSIGNED' ? 'Assigned' : 'Not Assigned';

								return (
									<button
										key={option}
										type="button"
										onClick={() => setAssignmentFilter(option)}
										className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
											isActive
												? 'bg-yellow-500 text-white'
												: 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
										}`}
									>
										{label}
									</button>
								);
							})}
						</div>

						<div className="text-xs text-muted-foreground">
							Showing {filteredTickets.length} of {tickets.length} tickets
						</div>
					</div>

					<div className="max-h-[75vh] overflow-y-auto">
						{loadingList ? (
							<div className="p-4 text-sm text-muted-foreground">Loading tickets...</div>
						) : filteredTickets.length === 0 ? (
							<div className="p-4 text-sm text-muted-foreground">No tickets found for the current filter.</div>
						) : (
							filteredTickets.map((ticket) => {
								const isActive = ticket.id === selectedTicketId;

								return (
									<button
										key={ticket.id}
										type="button"
										onClick={() => setSelectedTicketId(ticket.id)}
										className={`w-full border-b border-border p-4 text-left transition-colors ${
											isActive ? 'bg-yellow-50 dark:bg-yellow-900/10' : 'hover:bg-muted/40'
										}`}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2 text-xs text-muted-foreground">
													<span>{ticket.id}</span>
													<span className={`rounded-full px-2 py-1 font-medium ${getStatusBadgeClass(ticket.status)}`}>
														{formatEnum(ticket.status)}
													</span>
													<span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground">
														{ticket.assigneeId ? 'Assigned' : 'Not assigned'}
													</span>
												</div>

												<h2 className="mt-2 truncate text-sm font-semibold text-foreground">{ticket.title}</h2>
												<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.description}</p>
											</div>

											<span className={`rounded-full px-2 py-1 text-xs font-medium ${getPriorityBadgeClass(ticket.priority)}`}>
												{formatEnum(ticket.priority)}
											</span>
										</div>

										<div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
											<span className="truncate">{ticket.customerEmail || 'No email'}</span>
										</div>
									</button>
								);
							})
						)}
					</div>
				</section>

				<section className="rounded-lg border border-border bg-card shadow-sm">
					{error ? (
						<div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
							{error}
						</div>
					) : null}

					{success ? (
						<div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
							{success}
						</div>
					) : null}

					{!selectedTicketId ? (
						<div className="p-8 text-sm text-muted-foreground">Select a ticket to view its details.</div>
					) : loadingDetail || !selectedTicket ? (
						<div className="p-8 text-sm text-muted-foreground">Loading ticket details...</div>
					) : (
						<div className="flex max-h-[75vh] flex-col">
							<div className="border-b border-border p-5">
								<div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-background p-5">
									<div>
										<div className="text-sm text-muted-foreground">Ticket {selectedTicket.id}</div>
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

								<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
									<div className="rounded-lg border border-border bg-background p-4">
										<div className="text-xs uppercase tracking-wide text-muted-foreground">Customer Email</div>
										<div className="mt-1 break-all text-sm font-medium text-foreground">
											{displayCustomerEmail}
										</div>
									</div>

									<div className="rounded-lg border border-border bg-background p-4">
										<div className="text-xs uppercase tracking-wide text-muted-foreground">Created</div>
										<div className="mt-1 text-sm font-medium text-foreground">{formatDateTime(selectedTicket.createdAt)}</div>
									</div>
									<div className="rounded-lg border border-border bg-background p-4">
										<div className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Agent</div>
										<div className="mt-1 text-sm font-medium text-foreground">
											{selectedTicket.assignedAgentName || selectedTicket.assignedAgentEmail || 'Unassigned'}
										</div>
									</div>
								</div>

								<div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
									<div className="rounded-lg border border-border bg-background p-4">
										<div className="text-xs uppercase tracking-wide text-muted-foreground">Assign Support Team Member</div>
										<div className="mt-3 flex flex-wrap items-center gap-3">
											<select
												value={selectedAssigneeId}
												onChange={(event) => setSelectedAssigneeId(event.target.value)}
												disabled={loadingMembers || assigningMember}
												className="min-w-[260px] flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
											>
												<option value="">Select support member</option>
												{supportMembers
													.filter((member) => member.active)
													.map((member) => (
														<option key={member.id} value={member.id}>
															{member.username} ({member.currentTicketCount ?? 0}/{member.maxTickets ?? 10})
														</option>
													))}
											</select>

											<button
												type="button"
												onClick={assignSupportMember}
												disabled={!selectedAssigneeId || loadingMembers || assigningMember}
												className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-60"
											>
												{assigningMember ? 'Assigning...' : 'Assign Member'}
											</button>
										</div>
									</div>

									<div className="rounded-lg border border-border bg-background p-4">
										<div className="text-xs uppercase tracking-wide text-muted-foreground">Ticket Actions</div>
										<div className="mt-3 flex flex-wrap items-center gap-3">
											<select
												value={selectedTicket.status}
												onChange={(event) => updateStatus(event.target.value as TicketStatus)}
												disabled={updatingTicket}
												className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
											>
												{STATUS_OPTIONS.filter((option) => option !== 'ALL').map((option) => (
													<option key={option} value={option}>
														{formatEnum(option)}
													</option>
												))}
											</select>

											{selectedTicket.status === 'RESOLVED' ? (
												<button
													type="button"
													onClick={reopenTicket}
													disabled={updatingTicket}
													className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
												>
													Reopen
												</button>
											) : (
												<button
													type="button"
													onClick={resolveTicket}
													disabled={updatingTicket}
													className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
												>
													Mark Solved
												</button>
											)}
										</div>
									</div>
								</div>

								{selectedTicket.errorLogs ? (
									<div className="mt-5 rounded-lg border border-border bg-background p-4">
										<div className="text-xs uppercase tracking-wide text-muted-foreground">Error Logs</div>
										<pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">{selectedTicket.errorLogs}</pre>
									</div>
								) : null}
							</div>

						</div>
					)}
				</section>
			</div>
		</div>
	);
}
