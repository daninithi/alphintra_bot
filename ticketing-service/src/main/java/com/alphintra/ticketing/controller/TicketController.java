package com.alphintra.ticketing.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alphintra.ticketing.dto.CreateTicketRequest;
import com.alphintra.ticketing.dto.TicketResponse;
import com.alphintra.ticketing.dto.TicketStats;
import com.alphintra.ticketing.dto.UpdateTicketRequest;
import com.alphintra.ticketing.model.TicketStatus;
import com.alphintra.ticketing.service.TicketService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;

    @PostMapping
    public ResponseEntity<TicketResponse> createTicket(@Valid @RequestBody CreateTicketRequest request, HttpServletRequest httpRequest) {
        String customerId = httpRequest.getHeader("X-User-Id");
        if (customerId == null || customerId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        
        // Override the userId with the one from header
        request.setUserId(customerId);
        
        TicketResponse response = ticketService.createTicket(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<TicketResponse>> getAllTickets() {
        List<TicketResponse> tickets = ticketService.getAllTickets();
        return ResponseEntity.ok(tickets);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TicketResponse> getTicketById(@PathVariable Long id) {
        TicketResponse ticket = ticketService.getTicketById(id);
        return ResponseEntity.ok(ticket);
    }

    @GetMapping("/my-tickets")
    public ResponseEntity<Map<String, Object>> getMyTickets(
            HttpServletRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String customerId = request.getHeader("X-User-Id");
        if (customerId == null || customerId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        
        List<TicketResponse> allTickets = ticketService.getTicketsByCustomer(customerId);
        
        // Apply pagination
        int totalElements = allTickets.size();
        int fromIndex = page * size;
        int toIndex = Math.min(fromIndex + size, totalElements);
        
        List<TicketResponse> paginatedTickets = allTickets.subList(fromIndex, toIndex);
        
        Map<String, Object> response = new HashMap<>();
        response.put("content", paginatedTickets);
        response.put("totalElements", totalElements);
        response.put("totalPages", (int) Math.ceil((double) totalElements / size));
        response.put("number", page);
        response.put("size", size);
        response.put("first", page == 0);
        response.put("last", toIndex >= totalElements);
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/stats")
    public ResponseEntity<TicketStats> getTicketStats(HttpServletRequest request) {
        String customerId = request.getHeader("X-User-Id");
        if (customerId == null || customerId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        TicketStats stats = ticketService.getTicketStatsForUser(customerId);
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/assignee/{assigneeId}")
    public ResponseEntity<List<TicketResponse>> getTicketsByAssignee(@PathVariable Long assigneeId) {
        List<TicketResponse> tickets = ticketService.getTicketsByAssignee(assigneeId);
        return ResponseEntity.ok(tickets);
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<TicketResponse>> getTicketsByStatus(@PathVariable TicketStatus status) {
        List<TicketResponse> tickets = ticketService.getTicketsByStatus(status);
        return ResponseEntity.ok(tickets);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TicketResponse> updateTicket(@PathVariable Long id, @Valid @RequestBody UpdateTicketRequest request) {
        TicketResponse response = ticketService.updateTicket(id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTicket(@PathVariable Long id) {
        ticketService.deleteTicket(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<TicketResponse> assignTicket(@PathVariable Long id, @RequestParam Long assigneeId) {
        TicketResponse response = ticketService.assignTicket(id, assigneeId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/resolve")
    public ResponseEntity<TicketResponse> resolveTicket(@PathVariable Long id) {
        TicketResponse response = ticketService.resolveTicket(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/reopen")
    public ResponseEntity<TicketResponse> reopenTicket(@PathVariable Long id) {
        TicketResponse response = ticketService.reopenTicket(id);
        return ResponseEntity.ok(response);
    }
}