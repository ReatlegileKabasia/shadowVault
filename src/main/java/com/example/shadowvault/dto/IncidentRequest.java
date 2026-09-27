package com.example.shadowvault.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record IncidentRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 40000) String details,
        @NotBlank @Size(max = 100) String timestamp) {
}
