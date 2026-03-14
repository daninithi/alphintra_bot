package com.alphintra.marketplace.repository;

import com.alphintra.marketplace.entity.UserStrategy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserStrategyRepository extends JpaRepository<UserStrategy, Integer> {
    Optional<UserStrategy> findByUserIdAndStrategyId(Integer userId, String strategyId);
    List<UserStrategy> findByUserIdAndAccessType(Integer userId, String accessType);
}
