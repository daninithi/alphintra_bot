package com.alphintra.marketplace.repository;

import com.alphintra.marketplace.entity.Strategy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StrategyRepository extends JpaRepository<Strategy, Integer> {
    List<Strategy> findByType(String type);
    Optional<Strategy> findByStrategyId(String strategyId);
}