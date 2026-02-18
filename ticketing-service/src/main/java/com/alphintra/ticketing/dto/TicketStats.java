package com.alphintra.ticketing.dto;

import java.util.Map;

import lombok.Data;

@Data
public class TicketStats {
    private long totalTickets;
    private long openTickets;
    private long resolvedTickets;
    private long closedTickets;
    private double averageResolutionTimeHours;
    private double averageSatisfactionRating;
    private long highPriorityTickets;
    private long escalatedTickets;
    private Map<String, Long> ticketsByCategory;
    private Map<String, Long> ticketsByPriority;
    private Map<String, Long> ticketsByStatus;
    private Map<String, Long> dailyTicketCreation;
}