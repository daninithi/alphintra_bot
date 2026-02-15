package com.alphintra.auth.service;

import com.alphintra.auth.dto.AuthResponse;
import com.alphintra.auth.dto.CreateUser;
import com.alphintra.auth.dto.LoginRequest;
import com.alphintra.auth.model.User;
import com.alphintra.auth.repository.UserRepository;
import com.alphintra.auth.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    public AuthResponse register(CreateUser createUser) {
        // Check if user already exists
        if (userRepository.existsByEmail(createUser.getEmail())) {
            throw new RuntimeException("Email already exists");
        }
        
        if (userRepository.existsByUsername(createUser.getUsername())) {
            throw new RuntimeException("Username already exists");
        }
        
        // Create new user
        User user = new User();
        user.setUsername(createUser.getUsername());
        user.setEmail(createUser.getEmail());
        user.setPassword(passwordEncoder.encode(createUser.getPassword()));
        
        User savedUser = userRepository.save(user);
        
        // Generate JWT token
        String token = jwtUtil.generateToken(
            savedUser.getEmail(),
            savedUser.getId(),
            savedUser.getUsername()
        );
        
        return new AuthResponse(
            token,
            savedUser.getId(),
            savedUser.getUsername(),
            savedUser.getEmail()
        );
    }
    
    public AuthResponse login(LoginRequest loginRequest) {
        // Find user by email
        User user = userRepository.findByEmail(loginRequest.getEmail())
            .orElseThrow(() -> new RuntimeException("Invalid email or password"));
        
        // Verify password
        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }
        
        // Generate JWT token
        String token = jwtUtil.generateToken(
            user.getEmail(),
            user.getId(),
            user.getUsername()
        );
        
        return new AuthResponse(
            token,
            user.getId(),
            user.getUsername(),
            user.getEmail()
        );
    }
}