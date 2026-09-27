package com.example.shadowvault.controller;

import com.example.shadowvault.model.Incident;
import com.example.shadowvault.model.User;
import com.example.shadowvault.dto.IncidentDetailsUpdate;
import com.example.shadowvault.dto.IncidentRekeyEntry;
import com.example.shadowvault.dto.IncidentRekeyRequest;
import com.example.shadowvault.dto.IncidentRequest;
import com.example.shadowvault.repository.IncidentRepository;
import com.example.shadowvault.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentRepository repository;
    private final UserRepository users;

    public IncidentController(IncidentRepository repository, UserRepository users) {
        this.repository = repository;
        this.users = users;
    }

    @GetMapping
    public List<Incident> getUserIncidents(@AuthenticationPrincipal Jwt jwt) {
        User user = getAuthenticatedUser(jwt);
        return repository.findByUserIdOrderByIdAsc(user.getId());
    }

    @PostMapping
    public Incident createIncident(
            @Valid @RequestBody IncidentRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        Incident incident = new Incident(
                request.title().trim(), request.details(), request.timestamp().trim());
        incident.setUser(getAuthenticatedUser(jwt));
        return repository.save(incident);
    }

    @PutMapping("/{id}")
    @Transactional
    public Incident updateIncidentDetails(
            @PathVariable Long id,
            @Valid @RequestBody IncidentDetailsUpdate request,
            @AuthenticationPrincipal Jwt jwt) {
        User user = getAuthenticatedUser(jwt);
        Incident incident = repository.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Incident not found."));
        incident.setDetails(request.details());
        return incident;
    }

    @PostMapping("/rekey")
    @Transactional
    public Map<String, Integer> rekeyUserIncidents(
            @Valid @RequestBody IncidentRekeyRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        User user = getAuthenticatedUser(jwt);
        List<Incident> incidents = repository.findByUserIdOrderByIdAsc(user.getId());
        List<IncidentRekeyEntry> entries = request.entries();
        if (entries.size() != incidents.size()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "The re-encryption set does not match the account archive.");
        }

        Set<Long> updatedIds = new HashSet<>();
        for (IncidentRekeyEntry entry : entries) {
            if (!updatedIds.add(entry.id())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "The re-encryption set contains duplicate records.");
            }
        }

        for (Incident incident : incidents) {
            if (!updatedIds.contains(incident.getId())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "The re-encryption set does not match the account archive.");
            }
        }

        Map<Long, String> encryptedDetails = entries.stream()
                .collect(java.util.stream.Collectors.toMap(
                        IncidentRekeyEntry::id, IncidentRekeyEntry::details));
        incidents.forEach(incident -> incident.setDetails(encryptedDetails.get(incident.getId())));
        repository.saveAll(incidents);
        return Map.of("updated", incidents.size());
    }

    private User getAuthenticatedUser(Jwt jwt) {
        try {
            long userId = Long.parseLong(jwt.getSubject());
            return users.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.UNAUTHORIZED, "Account no longer exists."));
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid access token.");
        }
    }
}