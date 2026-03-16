package com.alphintra.auth.dto;

import java.time.LocalDateTime;

import com.alphintra.auth.model.enums.AccountStatus;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AdminManagedUserResponse {
    private Long id;
    private String name;
    private String email;
    private AccountStatus accountStatus;
    private LocalDateTime createdDate;
    private String subscriptionStatus;
    private LocalDateTime subscriptionEndDate;
}
