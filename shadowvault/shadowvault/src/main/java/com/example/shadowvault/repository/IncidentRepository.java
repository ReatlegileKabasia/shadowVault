package com.example.shadowvault.repository;

import com.example.shadowvault.model.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Extending JpaRepository grants this interface access to built-in methods:
 * - save(Incident entity) -> Inserts or Updates a record
 * - findAll()             -> Selects all records
 * - findById(Long id)     -> Finds a record by ID
 * - deleteById(Long id)   -> Removes a record
 */
@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    // No code needed inside! Spring Boot writes the database logic automatically!
}