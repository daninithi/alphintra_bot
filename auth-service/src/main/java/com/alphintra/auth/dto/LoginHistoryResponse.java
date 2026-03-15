package com.alphintra.auth.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginHistoryResponse {
    private Long id;
    private LocalDateTime loginAt;
}
