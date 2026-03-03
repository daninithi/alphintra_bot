package com.alphintra.auth.controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alphintra.auth.model.SupportTeam;
import com.alphintra.auth.service.SupportTeamService;
import com.alphintra.auth.util.JwtUtil;

@RestController
@RequestMapping("/f/support")
public class SupportLoginController {

    @Autowired
    private SupportTeamService supportTeamService;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String password = request.get("password");

            if (username == null || username.trim().isEmpty() || 
                password == null || password.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(
                    Map.of("success", false, "message", "Username and password are required")
                );
            }

            Optional<SupportTeam> member = supportTeamService.login(username, password);
            
            if (member.isEmpty()) {
                return ResponseEntity.status(401).body(
                    Map.of("success", false, "message", "Invalid credentials or account is deactivated")
                );
            }

            SupportTeam supportMember = member.get();
            
            // Generate JWT token
            String token = jwtUtil.generateToken(
                supportMember.getEmail(),
                supportMember.getId(),
                supportMember.getUsername()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Login successful");
            response.put("token", token);
            response.put("user", Map.of(
                "id", supportMember.getId(),
                "username", supportMember.getUsername(),
                "email", supportMember.getEmail(),
                "role", "SUPPORT"
            ));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Login failed: " + e.getMessage())
            );
        }
    }
}
