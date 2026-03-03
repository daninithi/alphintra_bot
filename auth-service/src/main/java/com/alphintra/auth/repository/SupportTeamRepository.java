package com.alphintra.auth.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alphintra.auth.model.SupportTeam;

@Repository
public interface SupportTeamRepository extends JpaRepository<SupportTeam, Long> {
    Optional<SupportTeam> findByEmail(String email);
    Optional<SupportTeam> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    List<SupportTeam> findByActiveTrue();
}
