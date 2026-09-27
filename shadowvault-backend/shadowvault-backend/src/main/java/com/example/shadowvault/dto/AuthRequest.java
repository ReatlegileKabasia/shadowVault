package com.example.shadowvault.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthRequest(
        @NotBlank @Size(min = 3, max = 32) String username,
        @NotBlank @Size(min = 12, max = 72) String password) {
}
