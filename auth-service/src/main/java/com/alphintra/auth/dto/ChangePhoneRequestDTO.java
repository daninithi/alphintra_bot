package com.alphintra.auth.dto;

import lombok.Data;

@Data
public class ChangePhoneRequestDTO {
    private String userId;
    private String newPhone;
}
