package com.example.shadowvault.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record IncidentDetailsUpdate(
        @NotBlank @Size(max = 40000) String details) {
}
