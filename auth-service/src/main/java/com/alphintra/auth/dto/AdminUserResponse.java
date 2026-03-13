package com.alphintra.auth.dto;

import java.time.LocalDateTime;

import com.alphintra.auth.model.AccountStatus;
import com.alphintra.auth.model.User;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AdminUserResponse {
    private Long id;
    private String name;
    private String email;
    private AccountStatus accountStatus;
    private LocalDateTime createdDate;
    private LocalDateTime lastLogin;
    private Boolean emailVerified;

    public static AdminUserResponse fromEntity(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getAccountStatus(),
                user.getCreatedAt(),
                user.getLastLogin(),
                user.getEmailVerified());
    }
}
