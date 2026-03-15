package com.alphintra.marketplace.dto;

import lombok.Data;

@Data
public class SubscriptionActivateRequest {
    private String sessionId;
    private Long userId;
}
