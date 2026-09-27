package com.example.shadowvault.dto;

public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        String username) {
}
