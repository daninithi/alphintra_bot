package com.alphintra.ticketing.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request) {
        Ticket ticket = new Ticket();
        ticket.setStatus(TicketStatus.NEW); // Set status to NEW for new tickets
        ticket.setTitle(request.getTitle());
        ticket.setDescription(request.getDescription());
        ticket.setCategory(request.getCategory());
        ticket.setPriority(request.getPriority() != null ? request.getPriority() : TicketPriority.MEDIUM);
        ticket.setCustomerId(request.getUserId());
        ticket.setErrorLogs(request.getErrorLogs());

        // Convert lists to JSON strings
        if (request.getTags() != null && !request.getTags().isEmpty()) {
            try {
                ticket.setTags(objectMapper.writeValueAsString(request.getTags()));
            } catch (JsonProcessingException e) {
                // Handle error
            }
        }

        if (request.getAttachments() != null && !request.getAttachments().isEmpty()) {
            try {
                ticket.setAttachments(objectMapper.writeValueAsString(request.getAttachments()));
            } catch (JsonProcessingException e) {
                // Handle error
            }
        }

        Ticket savedTicket = ticketRepository.save(ticket);
        return mapToResponse(savedTicket);
    }

    public List<TicketResponse> getAllTickets() {
        return ticketRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public TicketResponse getTicketById(Long id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));
        return mapToResponse(ticket);
    }

    public List<TicketResponse> getTicketsByCustomer(String customerId) {
        return ticketRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<TicketResponse> getTicketsByAssignee(Long assigneeId) {
        return ticketRepository.findByAssigneeIdOrderByCreatedAtDesc(assigneeId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<TicketResponse> getTicketsByStatus(TicketStatus status) {
        return ticketRepository.findByStatusOrderByCreatedAtDesc(status).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TicketResponse updateTicket(Long id, UpdateTicketRequest request) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));

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
            ticket.setAssigneeId(request.getAssigneeId());
        }
        if (request.getErrorLogs() != null) {
            ticket.setErrorLogs(request.getErrorLogs());
        }

        // Update tags
        if (request.getTags() != null) {
            try {
                ticket.setTags(objectMapper.writeValueAsString(request.getTags()));
            } catch (JsonProcessingException e) {
                // Handle error
            }
        }

        // Update attachments
        if (request.getAttachments() != null) {
            try {
                ticket.setAttachments(objectMapper.writeValueAsString(request.getAttachments()));
            } catch (JsonProcessingException e) {
                // Handle error
            }
        }

        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
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
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));
        ticket.setAssigneeId(assigneeId);
        ticket.setStatus(TicketStatus.IN_PROGRESS);
        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
    }

    @Transactional
    public TicketResponse resolveTicket(Long id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));
        ticket.setStatus(TicketStatus.RESOLVED);
        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
    }

    @Transactional
    public TicketResponse reopenTicket(Long id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));
        ticket.setStatus(TicketStatus.OPEN);
        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
    }

    private TicketResponse mapToResponse(Ticket ticket) {
        TicketResponse response = new TicketResponse();
        response.setId(ticket.getId());
        response.setTitle(ticket.getTitle());
        response.setDescription(ticket.getDescription());
        response.setStatus(ticket.getStatus());
        response.setPriority(ticket.getPriority());
        response.setCategory(ticket.getCategory());
        response.setCustomerId(ticket.getCustomerId());
        response.setErrorLogs(ticket.getErrorLogs());
        response.setAssigneeId(ticket.getAssigneeId());
        response.setCreatedAt(ticket.getCreatedAt());
        response.setUpdatedAt(ticket.getUpdatedAt());

        // Parse JSON strings back to lists
        if (ticket.getTags() != null && !ticket.getTags().isEmpty()) {
            try {
                response.setTags(objectMapper.readValue(ticket.getTags(), new TypeReference<List<String>>() {}));
            } catch (JsonProcessingException e) {
                response.setTags(List.of());
            }
        }

        if (ticket.getAttachments() != null && !ticket.getAttachments().isEmpty()) {
            try {
                response.setAttachments(objectMapper.readValue(ticket.getAttachments(), new TypeReference<List<String>>() {}));
            } catch (JsonProcessingException e) {
                response.setAttachments(List.of());
            }
        }

        return response;
    }

    public TicketStats getTicketStatsForUser(String userId) {
        TicketStats stats = new TicketStats();
        List<Ticket> userTickets = ticketRepository.findByCustomerIdOrderByCreatedAtDesc(userId);

        stats.setTotalTickets(userTickets.size());
        stats.setOpenTickets((int) userTickets.stream().filter(t -> t.getStatus() == TicketStatus.OPEN).count());
        stats.setResolvedTickets((int) userTickets.stream().filter(t -> t.getStatus() == TicketStatus.RESOLVED).count());
        stats.setClosedTickets((int) userTickets.stream().filter(t -> t.getStatus() == TicketStatus.CLOSED).count());
        // For simplicity, set others to 0 or calculate if needed
        stats.setAverageResolutionTimeHours(0.0);
        stats.setAverageSatisfactionRating(0.0);
        stats.setHighPriorityTickets(0);
        stats.setEscalatedTickets(0);
        stats.setTicketsByCategory(null);
        stats.setTicketsByPriority(null);
        stats.setTicketsByStatus(null);
        stats.setDailyTicketCreation(null);

        return stats;
    }
}