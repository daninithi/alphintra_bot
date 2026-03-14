package com.alphintra.ticketing.client.dto;

import lombok.Data;

@Data
public class AuthSupportAssigneeLookupResponse {

    private boolean success;
    private String message;
    private AuthSupportMember assignee;
}