package com.alphintra.ticketing.client.dto;

import lombok.Data;

@Data
public class AuthUserResponse {
    private Long id;
    private String email;
    private String username;
    private String firstName;
    private String lastName;
}
