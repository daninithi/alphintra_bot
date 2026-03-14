package com.alphintra.ticketing.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AuthDefaultAdminResponse {

    private boolean success;
    private String message;
    private AdminProfile admin;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AdminProfile {
        private Long id;
        private String username;
        private String email;
    }
}
