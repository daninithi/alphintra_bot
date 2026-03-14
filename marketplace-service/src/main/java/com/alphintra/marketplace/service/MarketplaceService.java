package com.alphintra.marketplace.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alphintra.marketplace.entity.Strategy;
import com.alphintra.marketplace.entity.UserStrategy;
import com.alphintra.marketplace.repository.StrategyRepository;
import com.alphintra.marketplace.repository.UserStrategyRepository;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;

@Service
public class MarketplaceService {

    private final StrategyRepository strategyRepository;
    private final UserStrategyRepository userStrategyRepository;

    public MarketplaceService(StrategyRepository strategyRepository,
                              UserStrategyRepository userStrategyRepository) {
        this.strategyRepository = strategyRepository;
        this.userStrategyRepository = userStrategyRepository;
    }

    public List<Strategy> getMarketplaceStrategies() {
        return strategyRepository.findAll();
    }

    public void buyStrategy(Integer userId, String strategyId) {
        Strategy strategy = strategyRepository.findByStrategyId(strategyId)
                .orElseThrow(() -> new RuntimeException("Strategy not found"));

        userStrategyRepository.findByUserIdAndStrategyId(userId, strategyId)
                .ifPresent(existing -> {
                    throw new RuntimeException("Strategy already purchased");
                });

        UserStrategy userStrategy = new UserStrategy();
        userStrategy.setUserId(userId);
        userStrategy.setStrategyId(strategyId);
        userStrategy.setAccessType("purchased");
        userStrategy.setPurchasedAt(LocalDateTime.now());
        userStrategy.setPurchasePrice(strategy.getPrice());
        userStrategy.setCreatedAt(LocalDateTime.now());

        userStrategyRepository.save(userStrategy);

        Integer total = strategy.getTotalPurchases() == null ? 0 : strategy.getTotalPurchases();
        strategy.setTotalPurchases(total + 1);
        strategyRepository.save(strategy);
    }

    public List<Strategy> getBoughtStrategies(Integer userId) {
        List<UserStrategy> purchases =
                userStrategyRepository.findByUserIdAndAccessType(userId, "purchased");

        List<String> strategyIds = purchases.stream()
                .map(UserStrategy::getStrategyId)
                .toList();

        if (strategyIds.isEmpty()) {
            return List.of();
        }

        return strategyRepository.findAll().stream()
                .filter(strategy -> strategyIds.contains(strategy.getStrategyId()))
                .toList();
    }

    public String createCheckoutSession(
            String strategyId,
            Long userId,
            String email,
            String successUrl,
            String cancelUrl
    ) throws Exception {
        Strategy strategy = strategyRepository.findByStrategyId(strategyId)
                .orElseThrow(() -> new RuntimeException("Strategy not found"));

        if (strategy.getPrice() == null || strategy.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Free strategies do not require payment");
        }

        long unitAmount = strategy.getPrice()
                .multiply(new BigDecimal("100"))
                .longValueExact();

        SessionCreateParams params =
                SessionCreateParams.builder()
                        .setMode(SessionCreateParams.Mode.PAYMENT)
                        .setSuccessUrl(successUrl)
                        .setCancelUrl(cancelUrl)
                        .setCustomerEmail(email)
                        .addLineItem(
                                SessionCreateParams.LineItem.builder()
                                        .setQuantity(1L)
                                        .setPriceData(
                                                SessionCreateParams.LineItem.PriceData.builder()
                                                        .setCurrency("usd")
                                                        .setUnitAmount(unitAmount)
                                                        .setProductData(
                                                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                        .setName(strategy.getName())
                                                                        .setDescription(strategy.getDescription())
                                                                        .build()
                                                        )
                                                        .build()
                                        )
                                        .build()
                        )
                        .putMetadata("strategyId", strategy.getStrategyId())
                        .putMetadata("userId", String.valueOf(userId))
                        .build();

        Session session = Session.create(params);
        return session.getUrl();
    }
}