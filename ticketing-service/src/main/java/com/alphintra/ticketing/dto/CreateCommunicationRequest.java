package com.alphintra.ticketing.dto;

import com.alphintra.ticketing.model.CommunicationSenderType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateCommunicationRequest {

    @NotBlank(message = "Content is required")
    private String content;

    @NotNull(message = "Sender type is required")
    private CommunicationSenderType senderType;

    @NotBlank(message = "Sender ID is required")
    private String senderId;

    private String senderName;

    private String senderEmail;

    private Boolean isInternal;
}
