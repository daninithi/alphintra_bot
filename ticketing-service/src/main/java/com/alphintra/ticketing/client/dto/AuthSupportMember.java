package com.alphintra.ticketing.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AuthSupportMember {

    private Long id;
    private String username;
    private String email;
    private Boolean active;
    private String assignedCategory;
    private String specializationLevel;
    private Integer currentTicketCount;
    private Integer maxTickets;
    private Integer currentLoad;
}