package com.alphintra.auth.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alphintra.auth.model.Admin;

@Repository
public interface AdminRepository extends JpaRepository<Admin, Long> {
    
    Optional<Admin> findByEmail(String email);
    
    Optional<Admin> findByUsername(String username);

    Optional<Admin> findFirstByOrderByIdAsc();
    
    boolean existsByEmail(String email);
    
    boolean existsByUsername(String username);
    
    long count();
}
