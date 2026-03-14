package com.alphintra.ticketing.client.dto;

import java.util.List;

import lombok.Data;

@Data
public class AuthSupportMemberListResponse {

    private boolean success;
    private String message;
    private List<AuthSupportMember> members;
}