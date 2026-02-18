package com.alphintra.ticketing.dto;

import java.util.List;

import com.alphintra.ticketing.model.TicketCategory;
import com.alphintra.ticketing.model.TicketPriority;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateTicketRequest {

    private String userId;

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Description is required")
    private String description;

    @NotNull(message = "Category is required")
    private TicketCategory category;

    private TicketPriority priority;

    private List<String> tags;

    private String errorLogs;

    private List<String> attachments;
}