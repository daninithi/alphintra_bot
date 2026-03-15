package com.alphintra.marketplace.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alphintra.marketplace.dto.ApiMessage;
import com.alphintra.marketplace.dto.BuyStrategyRequest;
import com.alphintra.marketplace.dto.CheckoutSessionRequest;
import com.alphintra.marketplace.entity.Strategy;
import com.alphintra.marketplace.service.MarketplaceService;

@RestController
@RequestMapping("/marketplace")
public class MarketplaceController {

    private final MarketplaceService marketplaceService;

    public MarketplaceController(MarketplaceService marketplaceService) {
        this.marketplaceService = marketplaceService;
    }

    @GetMapping("/strategies")
    public ResponseEntity<List<Strategy>> getStrategies() {
        List<Strategy> data = marketplaceService.getMarketplaceStrategies();
        System.out.println("Marketplace strategies count: " + data.size());
        return ResponseEntity.ok(data);
    }

    @PostMapping("/strategies/{strategyId}/buy")
    public ResponseEntity<?> buyStrategy(
            @PathVariable String strategyId,
            @RequestBody BuyStrategyRequest request
    ) {
        try {
            marketplaceService.buyStrategy(request.getUserId(), strategyId);
            return ResponseEntity.ok(new ApiMessage("Strategy purchased successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ApiMessage(e.getMessage()));
        }
    }

    @GetMapping("/library/bought/{userId}")
    public ResponseEntity<List<Strategy>> getBoughtStrategies(@PathVariable Integer userId) {
        List<Strategy> data = marketplaceService.getBoughtStrategies(userId);
        System.out.println("Bought strategies count for user " + userId + ": " + data.size());
        return ResponseEntity.ok(data);
    }

    @PostMapping("/payments/create-checkout-session")
    public ResponseEntity<Map<String, String>> createCheckoutSession(
            @RequestBody CheckoutSessionRequest request
    ) {
        try {
            String checkoutUrl = marketplaceService.createCheckoutSession(
                    request.getStrategyId(),
                    request.getUserId(),
                    request.getEmail(),
                    request.getSuccessUrl(),
                    request.getCancelUrl()
            );

            return ResponseEntity.ok(Map.of("checkoutUrl", checkoutUrl));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to create checkout session"));
        }
    }
}