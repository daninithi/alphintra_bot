package com.alphintra.auth.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.alphintra.auth.dto.AuthResponse;
import com.alphintra.auth.dto.AdminManagedUserResponse;
import com.alphintra.auth.dto.ChangePasswordRequest;
import com.alphintra.auth.dto.CreateUser;
import com.alphintra.auth.dto.DeleteAccountRequest;
import com.alphintra.auth.dto.LoginHistoryResponse;
import com.alphintra.auth.dto.LoginRequest;
import com.alphintra.auth.model.Admin;
import com.alphintra.auth.model.LoginHistory;
import com.alphintra.auth.model.User;
import com.alphintra.auth.model.enums.AccountStatus;
import com.alphintra.auth.repository.AdminRepository;
import com.alphintra.auth.repository.LoginHistoryRepository;
import com.alphintra.auth.repository.UserRepository;
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
    private UserRepository userRepository;

    @Autowired
    private LoginHistoryRepository loginHistoryRepository;

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
                savedAdmin.getUsername());

        return new AuthResponse(
                token,
                savedAdmin.getId(),
                savedAdmin.getUsername(),
                savedAdmin.getEmail());
    }

    public AuthResponse login(LoginRequest loginRequest) {
        // if (FIXED_ADMIN_EMAIL.equalsIgnoreCase(loginRequest.getEmail())
        // && FIXED_ADMIN_PASSWORD.equals(loginRequest.getPassword())) {
        // Admin fixedAdmin = adminRepository.findByEmail(FIXED_ADMIN_EMAIL)
        // .orElseGet(() -> {
        // Admin admin = new Admin();
        // admin.setUsername(FIXED_ADMIN_USERNAME);
        // admin.setEmail(FIXED_ADMIN_EMAIL);
        // admin.setPassword(passwordEncoder.encode(FIXED_ADMIN_PASSWORD));
        // return adminRepository.save(admin);
        // });

        // String token = jwtUtil.generateToken(
        // fixedAdmin.getEmail(),
        // fixedAdmin.getId(),
        // fixedAdmin.getUsername());

        // return new AuthResponse(
        // token,
        // fixedAdmin.getId(),
        // fixedAdmin.getUsername(),
        // fixedAdmin.getEmail());
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
                admin.getUsername());

        return new AuthResponse(
                token,
                admin.getId(),
                admin.getUsername(),
                admin.getEmail());
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

    public List<AdminManagedUserResponse> getManagedUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toManagedUserResponse)
                .toList();
    }

    public AdminManagedUserResponse getManagedUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return toManagedUserResponse(user);
    }

    public AdminManagedUserResponse suspendManagedUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setAccountStatus(AccountStatus.SUSPENDED);
        User saved = userRepository.save(user);
        return toManagedUserResponse(saved);
    }

    public AdminManagedUserResponse unsuspendManagedUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setAccountStatus(AccountStatus.ACTIVE);
        User saved = userRepository.save(user);
        return toManagedUserResponse(saved);
    }

    public void deleteManagedUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Check if already deleted
        if (Boolean.TRUE.equals(user.getDeleted())) {
            throw new RuntimeException("User is already deleted");
        }
        
        // Soft delete
        user.setDeleted(true);
        user.setDeletedAt(java.time.LocalDateTime.now());
        userRepository.save(user);
    }

    private AdminManagedUserResponse toManagedUserResponse(User user) {
        AccountStatus status;
        if (Boolean.TRUE.equals(user.getDeleted())) {
            status = AccountStatus.DELETED;
        } else {
            status = user.getAccountStatus() != null ? user.getAccountStatus() : AccountStatus.ACTIVE;
        }
        return new AdminManagedUserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                status,
                user.getCreatedAt());
    }

    public List<LoginHistoryResponse> getUserLoginHistory(Long userId) {
        return loginHistoryRepository.findByUserIdOrderByLoginAtDesc(userId)
                .stream()
                .map(history -> new LoginHistoryResponse(history.getId(), history.getLoginAt()))
                .collect(Collectors.toList());
    }
}
