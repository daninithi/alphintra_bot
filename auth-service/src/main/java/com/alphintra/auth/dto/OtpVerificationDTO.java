package com.alphintra.auth.dto;

import lombok.Data;

@Data
public class OtpVerificationDTO {
    private String email;
    private String otp;
}
