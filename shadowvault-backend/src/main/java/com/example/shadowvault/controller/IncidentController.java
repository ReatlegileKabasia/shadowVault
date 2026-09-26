package com.example.shadowvault.controller;

import com.example.shadowvault.model.Incident;
import com.example.shadowvault.repository.IncidentRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/incidents") // Base URL endpoint
@CrossOrigin(origins = "*")       // Allows our web frontend to send requests without CORS blocking
public class IncidentController {

    private final IncidentRepository repository;

    // Dependency Injection: Spring automatically passes our Repository into this controller
    public IncidentController(IncidentRepository repository) {
        this.repository = repository;
    }

    /**
     * GET Endpoint: http://localhost:8080/api/incidents
     * Returns a JSON list of all recorded incidents from the database.
     */
    @GetMapping
    public List<Incident> getAllIncidents() {
        return repository.findAll();
    }

    /**
     * POST Endpoint: http://localhost:8080/api/incidents
     * Receives JSON from the frontend, converts it into an Incident object,
     * and saves it into the database.
     */
    @PostMapping
    public Incident createIncident(@RequestBody Incident incident) {
        return repository.save(incident);
    }
}