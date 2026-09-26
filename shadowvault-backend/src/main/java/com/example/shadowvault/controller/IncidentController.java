package com.example.shadowvault.controller;

import com.example.shadowvault.model.Incident;
import com.example.shadowvault.model.User;
import com.example.shadowvault.dto.IncidentRequest;
import com.example.shadowvault.repository.IncidentRepository;
import com.example.shadowvault.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

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