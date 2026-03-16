package com.alphintra.ticketing.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.alphintra.ticketing.model.TicketCategory;
import com.alphintra.ticketing.model.TicketPriority;
import com.alphintra.ticketing.model.TicketStatus;

import lombok.Data;

@Data
public class TicketResponse {

    private Long id;
    private String title;
    private String description;
    private TicketStatus status;
    private TicketPriority priority;
    private TicketCategory category;
    private String customerId;
    private String customerEmail;
    private String customerName;
    private String errorLogs;
    private List<String> tags;
    private List<String> attachments;
    private Long assigneeId;
    private String assignedAgentName;
    private String assignedAgentEmail;
    private Boolean assigned;
    private Integer communicationCount;
    private Integer customerUnreadCount;
    private Integer agentUnreadCount;
    private Boolean hasUnreadMessages;
    private LocalDateTime lastCommunicationAt;
    private String notificationRecipientEmail;
    private String notificationRecipientName;
    private String notificationSubject;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}