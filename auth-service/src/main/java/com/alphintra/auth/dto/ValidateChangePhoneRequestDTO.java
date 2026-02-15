package com.alphintra.auth.dto;

import lombok.Data;

@Data
public class ValidateChangePhoneRequestDTO {
    private String userId;
    private String newPhone;
    private String otp;
}
