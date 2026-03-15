package com.alphintra.marketplace.dto;

import lombok.Data;

@Data
public class SubscriptionCheckoutRequest {
    private Long userId;
    private String email;
    private String plan; // "monthly" or "yearly"
    private String successUrl;
    private String cancelUrl;
}
