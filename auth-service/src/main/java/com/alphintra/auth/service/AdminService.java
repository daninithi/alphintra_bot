package com.alphintra.auth.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.alphintra.auth.dto.AuthResponse;
import com.alphintra.auth.dto.ChangePasswordRequest;
import com.alphintra.auth.dto.CreateUser;
import com.alphintra.auth.dto.DeleteAccountRequest;
import com.alphintra.auth.dto.LoginRequest;
import com.alphintra.auth.model.Admin;
import com.alphintra.auth.repository.AdminRepository;
import com.alphintra.auth.util.JwtUtil;

@Service
public class AdminService {

    // private static final String FIXED_ADMIN_EMAIL = "alphintraadmin@gmail.com";
    // private static final String FIXED_ADMIN_PASSWORD = "Admin123";
    // private static final String FIXED_ADMIN_USERNAME = "alphintraadmin";

    @Autowired
    private AdminRepository adminRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    public AuthResponse register(CreateUser createUser) {
        // Check if admin already exists (only one admin allowed)
        long adminCount = adminRepository.count();
        if (adminCount >= 1) {
            throw new RuntimeException("Admin already exists. Only one admin is allowed in the system.");
        }
        
        // Check if email already exists
        if (adminRepository.existsByEmail(createUser.getEmail())) {
            throw new RuntimeException("Email already exists");
        }
        
        // Check if username already exists
        if (adminRepository.existsByUsername(createUser.getUsername())) {
            throw new RuntimeException("Username already exists");
        }
        
        // Create new admin
        Admin admin = new Admin();
        admin.setUsername(createUser.getUsername());
        admin.setEmail(createUser.getEmail());
        admin.setPassword(passwordEncoder.encode(createUser.getPassword()));
        
        Admin savedAdmin = adminRepository.save(admin);
        
        // Generate JWT token
        String token = jwtUtil.generateToken(
            savedAdmin.getEmail(),
            savedAdmin.getId(),
            savedAdmin.getUsername()
        );
        
        return new AuthResponse(
            token,
            savedAdmin.getId(),
            savedAdmin.getUsername(),
            savedAdmin.getEmail()
        );
    }
    
    public AuthResponse login(LoginRequest loginRequest) {
        // if (FIXED_ADMIN_EMAIL.equalsIgnoreCase(loginRequest.getEmail())
        //         && FIXED_ADMIN_PASSWORD.equals(loginRequest.getPassword())) {
        //     Admin fixedAdmin = adminRepository.findByEmail(FIXED_ADMIN_EMAIL)
        //             .orElseGet(() -> {
        //                 Admin admin = new Admin();
        //                 admin.setUsername(FIXED_ADMIN_USERNAME);
        //                 admin.setEmail(FIXED_ADMIN_EMAIL);
        //                 admin.setPassword(passwordEncoder.encode(FIXED_ADMIN_PASSWORD));
        //                 return adminRepository.save(admin);
        //             });

        //     String token = jwtUtil.generateToken(
        //             fixedAdmin.getEmail(),
        //             fixedAdmin.getId(),
        //             fixedAdmin.getUsername());

        //     return new AuthResponse(
        //             token,
        //             fixedAdmin.getId(),
        //             fixedAdmin.getUsername(),
        //             fixedAdmin.getEmail());
        // }

        // Find admin by email
        Admin admin = adminRepository.findByEmail(loginRequest.getEmail())
            .orElseThrow(() -> new RuntimeException("Invalid email or password"));
        
        // Verify password
        if (!passwordEncoder.matches(loginRequest.getPassword(), admin.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }
        
        // Generate JWT token
        String token = jwtUtil.generateToken(
            admin.getEmail(),
            admin.getId(),
            admin.getUsername()
        );
        
        return new AuthResponse(
            token,
            admin.getId(),
            admin.getUsername(),
            admin.getEmail()
        );
    }
    
    public boolean adminExists() {
        return adminRepository.count() > 0;
    }

    public Admin getPrimaryAdmin() {
        return adminRepository.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new RuntimeException("Admin not found"));
    }

    public void changePassword(String email, ChangePasswordRequest request) {
        // Find admin by email
        Admin admin = adminRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("Admin not found"));
        
        // Verify current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), admin.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }
        
        // Update password
        admin.setPassword(passwordEncoder.encode(request.getNewPassword()));
        adminRepository.save(admin);
    }
    
    public void deleteAccount(DeleteAccountRequest request) {
        // Find admin by email
        Admin admin = adminRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new RuntimeException("Admin not found"));
        
        // Verify password
        if (!passwordEncoder.matches(request.getPassword(), admin.getPassword())) {
            throw new RuntimeException("Incorrect password");
        }
        
        // Delete admin
        adminRepository.delete(admin);
    }
}
