package com.alphintra.marketplace.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alphintra.marketplace.entity.Strategy;

public interface StrategyRepository extends JpaRepository<Strategy, Integer> {
    List<Strategy> findByType(String type);
    List<Strategy> findByTypeAndCreatedBy(String type, String createdBy);
    List<Strategy> findByTypeAndAuthorIdNot(String type, Long authorId);
    Optional<Strategy> findByStrategyId(String strategyId);
}