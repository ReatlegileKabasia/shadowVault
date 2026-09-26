package com.example.shadowvault.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.FetchType;
import jakarta.persistence.Column;

/**
 * @Entity tells Spring Data JPA that this class represents
 * a table in our relational database.
 */
@Entity
@Table(name = "incidents")
public class Incident {

    /**
     * @Id marks this field as the Primary Key.
     * @GeneratedValue tells the database to automatically generate a unique ID (1, 2, 3...) for every log.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    // Column length increased so users can type long notes
    @Column(length = 40000)
    private String details;

    private String timestamp;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // Default No-Args Constructor (Required by JPA)
    public Incident() {}

    // Constructor with fields
    public Incident(String title, String details, String timestamp) {
        this.title = title;
        this.details = details;
        this.timestamp = timestamp;
    }

    // Getters and Setters (Allow Java to read and write private fields)
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}