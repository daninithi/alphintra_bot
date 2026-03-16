package com.alphintra.ticketing.dto;

import java.util.List;

import com.alphintra.ticketing.model.TicketCategory;
import com.alphintra.ticketing.model.TicketPriority;
import com.fasterxml.jackson.annotation.JsonAlias;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateTicketRequest {

    @JsonAlias("customerId")
    private String userId;

    @JsonAlias("customerEmail")
    private String userEmail;

    @JsonAlias({"customerName", "customerUserName"})
    private String userName;

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