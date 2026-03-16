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
@Table(name = "strategies")
@Getter
@Setter
public class Strategy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "strategy_id", nullable = false, unique = true)
    private String strategyId;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private String type;

    @Column(name = "python_class")
    private String pythonClass;

    @Column(name = "python_module")
    private String pythonModule;

    private BigDecimal price;

    @Column(name = "author_id")
    private Integer authorId;

    @Column(name = "publish_status")
    private String publishStatus;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "total_purchases")
    private Integer totalPurchases;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
