package com.alphintra.ticketing.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alphintra.ticketing.client.AuthSupportClient;
import com.alphintra.ticketing.client.dto.AuthSupportAssigneeLookupResponse;
import com.alphintra.ticketing.client.dto.AuthSupportMember;
import com.alphintra.ticketing.client.dto.AuthSupportMemberListResponse;
import com.alphintra.ticketing.client.dto.AuthUserResponse;
import com.alphintra.ticketing.dto.CreateTicketRequest;
import com.alphintra.ticketing.dto.TicketResponse;
import com.alphintra.ticketing.dto.TicketStats;
import com.alphintra.ticketing.dto.UpdateTicketRequest;
import com.alphintra.ticketing.model.Ticket;
import com.alphintra.ticketing.model.TicketPriority;
import com.alphintra.ticketing.model.TicketStatus;
import com.alphintra.ticketing.repository.TicketRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepository;
    private final AuthSupportClient authSupportClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request) {
        Ticket ticket = new Ticket();
        ticket.setStatus(TicketStatus.NEW);
        ticket.setTitle(request.getTitle());
        ticket.setDescription(request.getDescription());
        ticket.setCategory(request.getCategory());
        ticket.setPriority(request.getPriority() != null ? request.getPriority() : TicketPriority.MEDIUM);
        ticket.setCustomerId(request.getUserId());
        ticket.setCustomerEmail(request.getUserEmail());
        ticket.setCustomerName(request.getUserName());
        ticket.setErrorLogs(request.getErrorLogs());
        ticket.setTags(writeStringList(request.getTags()));
        ticket.setAttachments(null);

        routeTicket(ticket);

        Ticket savedTicket = ticketRepository.save(ticket);

        NotificationRouting routing = buildRoutingForTicketCreation(savedTicket);
        return mapToResponse(savedTicket, false, routing);
    }

    public List<TicketResponse> getAllTickets(TicketStatus status, Long assigneeId, String customerId) {
        return ticketRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .filter(ticket -> status == null || ticket.getStatus() == status)
                .filter(ticket -> assigneeId == null || Objects.equals(ticket.getAssigneeId(), assigneeId))
                .filter(ticket -> customerId == null || Objects.equals(ticket.getCustomerId(), customerId))
                .map(ticket -> mapToResponse(ticket, true, null))
                .collect(Collectors.toList());
    }

    public TicketResponse getTicketById(Long id, boolean agentView) {
        Ticket ticket = getTicketEntity(id);
        return mapToResponse(ticket, agentView, null);
    }

    public List<TicketResponse> getTicketsByCustomer(String customerId) {
        return ticketRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(ticket -> mapToResponse(ticket, false, null))
                .collect(Collectors.toList());
    }

    public List<TicketResponse> getTicketsByAssignee(Long assigneeId) {
        return ticketRepository.findByAssigneeIdOrderByCreatedAtDesc(assigneeId).stream()
                .map(ticket -> mapToResponse(ticket, true, null))
                .collect(Collectors.toList());
    }

    public List<TicketResponse> getTicketsByStatus(TicketStatus status) {
        return ticketRepository.findByStatusOrderByCreatedAtDesc(status).stream()
                .map(ticket -> mapToResponse(ticket, true, null))
                .collect(Collectors.toList());
    }

    @Transactional
    public TicketResponse updateTicket(Long id, UpdateTicketRequest request, boolean agentView) {
        Ticket ticket = getTicketEntity(id);

        if (request.getTitle() != null) {
            ticket.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            ticket.setDescription(request.getDescription());
        }
        if (request.getPriority() != null) {
            ticket.setPriority(request.getPriority());
        }
        if (request.getStatus() != null) {
            ticket.setStatus(request.getStatus());
        }
        if (request.getCategory() != null) {
            ticket.setCategory(request.getCategory());
        }
        if (request.getAssigneeId() != null) {
            Long previousAssigneeId = ticket.getAssigneeId();
            ticket.setAssigneeId(request.getAssigneeId());
            AuthSupportMember assignee = resolveSupportMember(request.getAssigneeId()).orElse(null);
            ticket.setAssigneeName(request.getAssigneeName() != null ? request.getAssigneeName() : assignee != null ? assignee.getUsername() : ticket.getAssigneeName());
            ticket.setAssigneeEmail(request.getAssigneeEmail() != null ? request.getAssigneeEmail() : assignee != null ? assignee.getEmail() : ticket.getAssigneeEmail());
            if (ticket.getStatus() == TicketStatus.NEW) {
                ticket.setStatus(TicketStatus.IN_PROGRESS);
            }
            ticket.setAssigned(true);
            // Update workload counters
            try {
                if (previousAssigneeId != null && !previousAssigneeId.equals(request.getAssigneeId())) {
                    authSupportClient.decrementLoad(previousAssigneeId);
                }
                if (previousAssigneeId == null || !previousAssigneeId.equals(request.getAssigneeId())) {
                    authSupportClient.incrementLoad(request.getAssigneeId());
                }
            } catch (Exception ignored) {}
        }
        if (request.getErrorLogs() != null) {
            ticket.setErrorLogs(request.getErrorLogs());
        }
        if (request.getTags() != null) {
            ticket.setTags(writeStringList(request.getTags()));
        }
        if (request.getAttachments() != null) {
            ticket.setAttachments(null);
        }

        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket, agentView, null);
    }

    @Transactional
    public void deleteTicket(Long id) {
        if (!ticketRepository.existsById(id)) {
            throw new RuntimeException("Ticket not found");
        }
        ticketRepository.deleteById(id);
    }

    @Transactional
    public TicketResponse assignTicket(Long id, Long assigneeId) {
        Ticket ticket = getTicketEntity(id);
        AuthSupportMember assignee = resolveSupportMember(assigneeId)
                .orElseThrow(() -> new RuntimeException("Support member not found"));

        ticket.setAssigneeId(assigneeId);
        ticket.setAssigneeName(assignee.getUsername());
        ticket.setAssigneeEmail(assignee.getEmail());
        ticket.setAssigned(true);
        if (ticket.getStatus() == TicketStatus.NEW) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
        }
        // Update workload: decrement old, increment new
        try {
            if (ticket.getAssigneeId() != null && !ticket.getAssigneeId().equals(assigneeId)) {
                authSupportClient.decrementLoad(ticket.getAssigneeId());
            }
            authSupportClient.incrementLoad(assigneeId);
        } catch (Exception ignored) {}

        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket, true, null);
    }

    @Transactional
    public TicketResponse resolveTicket(Long id) {
        Ticket ticket = getTicketEntity(id);
        ticket.setStatus(TicketStatus.RESOLVED);
        if (ticket.getAssigneeId() != null) {
            try { authSupportClient.decrementLoad(ticket.getAssigneeId()); } catch (Exception ignored) {}
        }
        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket, true, null);
    }

    @Transactional
    public TicketResponse reopenTicket(Long id) {
        Ticket ticket = getTicketEntity(id);
        ticket.setStatus(TicketStatus.REOPENED);
        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket, false, null);
    }

    public TicketStats getTicketStatsForUser(String userId) {
        TicketStats stats = new TicketStats();
        List<Ticket> userTickets = ticketRepository.findByCustomerIdOrderByCreatedAtDesc(userId);

        stats.setTotalTickets(userTickets.size());
        stats.setOpenTickets((int) userTickets.stream()
                .filter(ticket -> ticket.getStatus() == TicketStatus.NEW
                        || ticket.getStatus() == TicketStatus.IN_PROGRESS
                        || ticket.getStatus() == TicketStatus.REOPENED)
                .count());
        stats.setResolvedTickets((int) userTickets.stream().filter(ticket -> ticket.getStatus() == TicketStatus.RESOLVED).count());
        stats.setClosedTickets((int) userTickets.stream().filter(ticket -> ticket.getStatus() == TicketStatus.CLOSED).count());
        stats.setAverageResolutionTimeHours(0.0);
        stats.setAverageSatisfactionRating(0.0);
        stats.setHighPriorityTickets((int) userTickets.stream()
                .filter(ticket -> ticket.getPriority() == TicketPriority.HIGH
                        || ticket.getPriority() == TicketPriority.URGENT
                        || ticket.getPriority() == TicketPriority.CRITICAL)
                .count());
        stats.setEscalatedTickets((int) userTickets.stream().filter(ticket -> ticket.getStatus() == TicketStatus.ESCALATED).count());
        stats.setTicketsByCategory(userTickets.stream().collect(Collectors.groupingBy(ticket -> ticket.getCategory().name(), Collectors.counting())));
        stats.setTicketsByPriority(userTickets.stream().collect(Collectors.groupingBy(ticket -> ticket.getPriority().name(), Collectors.counting())));
        stats.setTicketsByStatus(userTickets.stream().collect(Collectors.groupingBy(ticket -> ticket.getStatus().name(), Collectors.counting())));
        stats.setDailyTicketCreation(null);
        return stats;
    }

    public List<Map<String, Object>> getSupportAgents() {
        AuthSupportMemberListResponse response = authSupportClient.getActiveMembers();
        List<AuthSupportMember> members = response != null && response.getMembers() != null ? response.getMembers() : List.of();

        return members.stream()
                .sorted(Comparator.comparing(AuthSupportMember::getUsername, Comparator.nullsLast(String::compareToIgnoreCase)))
            .map(member -> {
                Map<String, Object> agent = new LinkedHashMap<>();
                agent.put("agentId", String.valueOf(member.getId()));
                agent.put("username", Optional.ofNullable(member.getUsername()).orElse("support"));
                agent.put("email", Optional.ofNullable(member.getEmail()).orElse(""));
                agent.put("firstName", Optional.ofNullable(member.getUsername()).orElse("Support"));
                agent.put("lastName", "");
                agent.put("fullName", Optional.ofNullable(member.getUsername()).orElse("Support"));
                agent.put("agentLevel", mapAgentLevel(member.getSpecializationLevel()));
                agent.put("status", Boolean.TRUE.equals(member.getActive()) ? "AVAILABLE" : "OFFLINE");
                agent.put("specializations", member.getAssignedCategory() == null ? List.of() : List.of(member.getAssignedCategory()));
                agent.put("currentTicketCount", Optional.ofNullable(member.getCurrentTicketCount()).orElse(Optional.ofNullable(member.getCurrentLoad()).orElse(0)));
                agent.put("maxConcurrentTickets", Optional.ofNullable(member.getMaxTickets()).orElse(10));
                agent.put("isActive", Boolean.TRUE.equals(member.getActive()));
                return agent;
            })
                .collect(Collectors.toList());
    }

    private void routeTicket(Ticket ticket) {
        try {
            AuthSupportAssigneeLookupResponse response = authSupportClient.findBestAssignee(
                    ticket.getCategory().name(),
                    isHighPriority(ticket.getPriority()));

            if (response != null && response.isSuccess() && response.getAssignee() != null) {
                AuthSupportMember assignee = response.getAssignee();
                ticket.setAssigneeId(assignee.getId());
                ticket.setAssigneeName(assignee.getUsername());
                ticket.setAssigneeEmail(assignee.getEmail());
                ticket.setAssigned(true);
                if (ticket.getStatus() == TicketStatus.NEW) {
                    ticket.setStatus(TicketStatus.IN_PROGRESS);
                }
                try { authSupportClient.incrementLoad(assignee.getId()); } catch (Exception ignored) {}
            }
            // If no assignee (none in category, or all at capacity): leave as NEW / unassigned
        } catch (Exception ignored) {
            // Auth service unavailable — leave ticket unassigned
        }
    }

    private NotificationRouting buildRoutingForTicketCreation(Ticket ticket) {
        AdminContact adminContact = resolveAdminContact();
        return new NotificationRouting(
            firstNonBlank(ticket.getAssigneeEmail(), adminContact.email()),
            firstNonBlank(ticket.getAssigneeName(), adminContact.name()),
                "New support ticket #" + ticket.getId() + ": " + ticket.getTitle());
    }

    private Optional<AuthSupportMember> resolveSupportMember(Long assigneeId) {
        try {
            AuthSupportMemberListResponse response = authSupportClient.getAllMembers();
            if (response == null || response.getMembers() == null) {
                return Optional.empty();
            }

            return response.getMembers().stream()
                    .filter(member -> Objects.equals(member.getId(), assigneeId))
                    .findFirst();
        } catch (Exception error) {
            return Optional.empty();
        }
    }

    private Ticket getTicketEntity(Long id) {
        return ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));
    }

    private TicketResponse mapToResponse(Ticket ticket, boolean agentView, NotificationRouting routing) {
        TicketResponse response = new TicketResponse();
        response.setId(ticket.getId());
        response.setTitle(ticket.getTitle());
        response.setDescription(ticket.getDescription());
        response.setStatus(ticket.getStatus());
        response.setPriority(ticket.getPriority());
        response.setCategory(ticket.getCategory());
        response.setCustomerId(ticket.getCustomerId());
        response.setCustomerEmail(ticket.getCustomerEmail());
        response.setCustomerName(ticket.getCustomerName());

        // Backfill customer email/name from auth service if missing
        if ((ticket.getCustomerEmail() == null || ticket.getCustomerEmail().isBlank()) && ticket.getCustomerId() != null) {
            try {
                long custId = Long.parseLong(ticket.getCustomerId());
                AuthUserResponse user = authSupportClient.getUserById(custId);
                if (user != null) {
                    response.setCustomerEmail(user.getEmail());
                    if (ticket.getCustomerName() == null || ticket.getCustomerName().isBlank()) {
                        response.setCustomerName(user.getUsername() != null ? user.getUsername() : user.getEmail());
                    }
                    // Persist so future calls are fast
                    ticket.setCustomerEmail(user.getEmail());
                    if (ticket.getCustomerName() == null || ticket.getCustomerName().isBlank()) {
                        ticket.setCustomerName(user.getUsername() != null ? user.getUsername() : user.getEmail());
                    }
                    ticketRepository.save(ticket);
                }
            } catch (Exception ignored) {
                // Auth service unavailable or customer ID not numeric — skip
            }
        }
        response.setErrorLogs(ticket.getErrorLogs());
        response.setAssigneeId(ticket.getAssigneeId());
        response.setAssignedAgentName(ticket.getAssigneeName());
        response.setAssignedAgentEmail(ticket.getAssigneeEmail());
        response.setAssigned(ticket.getAssigned());
        response.setCreatedAt(ticket.getCreatedAt());
        response.setUpdatedAt(ticket.getUpdatedAt());
        response.setTags(readStringList(ticket.getTags()));
        response.setAttachments(readStringList(ticket.getAttachments()));

        if (routing != null) {
            response.setNotificationRecipientEmail(routing.recipientEmail());
            response.setNotificationRecipientName(routing.recipientName());
            response.setNotificationSubject(routing.subject());
        }

        return response;
    }

    private boolean isHighPriority(TicketPriority priority) {
        return priority == TicketPriority.HIGH || priority == TicketPriority.URGENT || priority == TicketPriority.CRITICAL;
    }

    private String mapAgentLevel(String specializationLevel) {
        if (specializationLevel == null) {
            return "L2";
        }

        return switch (specializationLevel) {
            case "JUNIOR" -> "L1";
            case "MID" -> "L2";
            case "SENIOR" -> "L3_SPECIALIST";
            default -> "L2";
        };
    }

    private String writeStringList(List<String> values) {
        if (values == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException error) {
            throw new RuntimeException("Failed to serialize list field", error);
        }
    }

    private List<String> readStringList(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(value, new TypeReference<List<String>>() { });
        } catch (JsonProcessingException error) {
            return List.of();
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private AdminContact resolveAdminContact() {
        return new AdminContact(null, "Admin", null);
    }

    private record NotificationRouting(String recipientEmail, String recipientName, String subject) {
    }

    private record AdminContact(Long id, String name, String email) {
    }
}