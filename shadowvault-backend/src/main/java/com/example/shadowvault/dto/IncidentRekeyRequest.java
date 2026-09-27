package com.example.shadowvault.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record IncidentRekeyRequest(
        @NotEmpty @Size(max = 500) List<@Valid IncidentRekeyEntry> entries) {
}
