package com.alphintra.auth.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alphintra.auth.dto.AuthResponse;
import com.alphintra.auth.dto.ChangePasswordRequest;
import com.alphintra.auth.dto.CreateUser;
import com.alphintra.auth.dto.DeleteAccountRequest;
import com.alphintra.auth.dto.LoginRequest;
import com.alphintra.auth.service.AuthService;
import com.alphintra.auth.util.JwtUtil;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/")
public class AuthController {

    @Autowired
    private AuthService authService;
    
    @Autowired
    private JwtUtil jwtUtil;

    @GetMapping("/f/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "service", "auth-service"
        ));
    }

    @PostMapping("/f/register")
    public ResponseEntity<?> register(@Valid @RequestBody CreateUser createUser) {
        try {
            AuthResponse response = authService.register(createUser);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }

    @PostMapping("/f/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest loginRequest) {
        try {
            AuthResponse response = authService.login(loginRequest);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "error", e.getMessage()
            ));
        }
    }
    
    @PutMapping("/users/password")
    public ResponseEntity<?> changePassword(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody ChangePasswordRequest request) {
        try {
            // Extract token from Bearer header
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            
            authService.changePassword(email, request);
            return ResponseEntity.ok(Map.of(
                "message", "Password changed successfully"
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }
    
    @DeleteMapping("/users/account")
    public ResponseEntity<?> deleteAccount(@Valid @RequestBody DeleteAccountRequest request) {
        try {
            authService.deleteAccount(request);
            return ResponseEntity.ok(Map.of(
                "message", "Account deleted successfully",
                "email", request.getEmail()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }

}