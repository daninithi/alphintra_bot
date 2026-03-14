package com.alphintra.marketplace.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "user_strategies")
@Getter
@Setter
public class UserStrategy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "strategy_id", nullable = false)
    private String strategyId;

    @Column(name = "access_type", nullable = false)
    private String accessType;

    @Column(name = "purchased_at")
    private LocalDateTime purchasedAt;

    @Column(name = "purchase_price")
    private BigDecimal purchasePrice;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}