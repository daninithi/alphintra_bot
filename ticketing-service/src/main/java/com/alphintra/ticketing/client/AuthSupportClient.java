package com.alphintra.ticketing.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.alphintra.ticketing.client.dto.AuthSupportAssigneeLookupResponse;
import com.alphintra.ticketing.client.dto.AuthSupportMemberListResponse;

@FeignClient(name = "authSupportClient", url = "${auth.service.url:http://localhost:8095}")
public interface AuthSupportClient {

    @GetMapping("/admin/support/find-assignee")
    AuthSupportAssigneeLookupResponse findBestAssignee(
            @RequestParam("category") String category,
            @RequestParam("highPriority") boolean highPriority);

    @GetMapping("/admin/support/active")
    AuthSupportMemberListResponse getActiveMembers();

    @GetMapping("/admin/support/all")
    AuthSupportMemberListResponse getAllMembers();
}