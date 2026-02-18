package com.alphintra.ticketing.dto;

import java.util.List;

import com.alphintra.ticketing.model.TicketCategory;
import com.alphintra.ticketing.model.TicketPriority;
import com.alphintra.ticketing.model.TicketStatus;

import lombok.Data;

@Data
public class UpdateTicketRequest {

    private String title;

    private String description;

    private TicketPriority priority;

    private TicketStatus status;

    private TicketCategory category;

    private Long assigneeId;

    private List<String> tags;

    private String errorLogs;

    private List<String> attachments;
}