package com.alphintra.ticketing.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.alphintra.ticketing.model.CommunicationSenderType;

import lombok.Data;

@Data
public class CommunicationResponse {

    private Long communicationId;
    private String ticketId;
    private String senderId;
    private String senderName;
    private CommunicationSenderType senderType;
    private String content;
    private Boolean isInternal;
    private List<String> attachments;
    private Boolean attachmentSent;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
    private String senderDisplayName;
    private String typeDisplayName;
    private Boolean isRead;
    private String notificationRecipientEmail;
    private String notificationRecipientName;
    private String notificationSubject;
}
