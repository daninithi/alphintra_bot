package com.alphintra.api_gateway.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import com.alphintra.api_gateway.security.util.JwtUtil;

import reactor.core.publisher.Mono;

@Component
public class AuthenticationFilter implements GlobalFilter, Ordered {

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        
        // Skip JWT check for public endpoints
        if (path.contains("/f/") || 
            path.contains("/swagger-ui.html") || 
            path.contains("/v3/api-docs") || 
            path.contains("/webjars") ||
            path.contains("/health") ||
            path.contains("/actuator")) {
            System.out.println("Skipping JWT check for path: " + path);
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || authHeader.isEmpty()) {
            System.out.println("Missing Authorization header: " + path);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        // Remove "Bearer " prefix if present
        String token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

        if (!jwtUtil.isTokenValid(token)) {
            System.out.println("Invalid or expired token: " + path);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        // Extract userId and add to request headers
        String userId = jwtUtil.extractUserId(token);
        ServerWebExchange modifiedExchange = exchange.mutate()
                .request(exchange.getRequest().mutate()
                        .header("X-User-Id", userId)
                        .build())
                .build();

        System.out.println("Valid token for path: " + path + ", userId: " + userId);
        return chain.filter(modifiedExchange);
    }

    @Override
    public int getOrder() {
        return -1; 
    }
}
