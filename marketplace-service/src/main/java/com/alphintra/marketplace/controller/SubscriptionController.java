package com.alphintra.marketplace.controller;

import com.alphintra.marketplace.dto.SubscriptionActivateRequest;
import com.alphintra.marketplace.dto.SubscriptionCheckoutRequest;
import com.alphintra.marketplace.service.SubscriptionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/marketplace/subscriptions")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<Map<String, String>> createCheckout(
            @RequestBody SubscriptionCheckoutRequest request) {
        try {
            String checkoutUrl = subscriptionService.createCheckoutSession(
                    request.getUserId(),
                    request.getEmail(),
                    request.getPlan(),
                    request.getSuccessUrl(),
                    request.getCancelUrl()
            );
            return ResponseEntity.ok(Map.of("checkoutUrl", checkoutUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/activate")
    public ResponseEntity<Map<String, String>> activate(
            @RequestBody SubscriptionActivateRequest request) {
        try {
            subscriptionService.activateSubscription(request.getSessionId());
            return ResponseEntity.ok(Map.of("status", "activated"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/status/{userId}")
    public ResponseEntity<?> getStatus(@PathVariable Long userId) {
        try {
            Map<String, Object> status = subscriptionService.getSubscriptionStatus(userId);
            String subStatus = (String) status.get("subscription_status");
            java.time.LocalDateTime endDate = null;
            Object endDateObj = status.get("subscription_end_date");
            if (endDateObj instanceof java.sql.Timestamp) {
                endDate = ((java.sql.Timestamp) endDateObj).toLocalDateTime();
            }

            boolean isActive = "active".equals(subStatus)
                    && (endDate == null || endDate.isAfter(java.time.LocalDateTime.now()));

            return ResponseEntity.ok(Map.of(
                    "isSubscribed", isActive,
                    "plan", status.get("subscription_plan") != null ? status.get("subscription_plan") : "free",
                    "endDate", endDate != null ? endDate.toString() : ""
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("isSubscribed", false, "plan", "free", "endDate", ""));
        }
    }
}
