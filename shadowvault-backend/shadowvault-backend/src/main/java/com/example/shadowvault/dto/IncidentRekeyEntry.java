package com.example.shadowvault.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record IncidentRekeyEntry(
        @NotNull @Positive Long id,
        @NotBlank @Size(max = 40000) String details) {
}
