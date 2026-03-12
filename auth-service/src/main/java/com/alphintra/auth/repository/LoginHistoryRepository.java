package com.alphintra.auth.repository;

import com.alphintra.auth.model.LoginHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Long> {

    List<LoginHistory> findByUserIdOrderByLoginAtDesc(Long userId);

    long countByUserId(Long userId);

    LoginHistory findTopByUserIdOrderByLoginAtAsc(Long userId);
}
