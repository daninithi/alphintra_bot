package com.alphintra.marketplace.service;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;

@Service
public class SubscriptionService {

    private static final long MONTHLY_PRICE_CENTS = 1000L; // $10.00
    private static final long YEARLY_PRICE_CENTS = 10000L; // $100.00

    private final JdbcTemplate jdbcTemplate;

    public SubscriptionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public String createCheckoutSession(Long userId, String email, String plan,
                                         String successUrl, String cancelUrl) throws Exception {
        boolean isYearly = "yearly".equalsIgnoreCase(plan);
        long unitAmount = isYearly ? YEARLY_PRICE_CENTS : MONTHLY_PRICE_CENTS;
        String productName = isYearly ? "Alphintra Pro (Yearly)" : "Alphintra Pro (Monthly)";

        SessionCreateParams params = SessionCreateParams.builder()
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
                                                                .setName(productName)
                                                                .setDescription("Unlimited strategy imports, purchases and publish requests")
                                                                .build()
                                                )
                                                .build()
                                )
                                .build()
                )
                .putMetadata("userId", String.valueOf(userId))
                .putMetadata("plan", plan.toLowerCase())
                .build();

        Session session = Session.create(params);
        return session.getUrl();
    }

    public void activateSubscription(String sessionId) throws Exception {
        Session session = Session.retrieve(sessionId);

        if (!"complete".equals(session.getStatus())) {
            throw new RuntimeException("Payment not completed");
        }

        Long userId = Long.parseLong(session.getMetadata().get("userId"));
        String plan = session.getMetadata().get("plan");

        LocalDateTime endDate = "yearly".equalsIgnoreCase(plan)
                ? LocalDateTime.now().plusYears(1)
                : LocalDateTime.now().plusMonths(1);

        jdbcTemplate.update(
                "UPDATE users SET subscription_status = 'active', subscription_plan = ?, " +
                "subscription_end_date = ?, stripe_customer_id = ? WHERE id = ?",
                plan, endDate, session.getCustomer(), userId
        );
    }

    public Map<String, Object> getSubscriptionStatus(Long userId) {
        return jdbcTemplate.queryForMap(
                "SELECT subscription_status, subscription_plan, subscription_end_date " +
                "FROM users WHERE id = ?",
                userId
        );
    }
}
