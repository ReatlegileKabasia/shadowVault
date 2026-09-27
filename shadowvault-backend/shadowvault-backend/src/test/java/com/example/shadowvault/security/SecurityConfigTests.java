package com.example.shadowvault.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecurityConfigTests {

    private final SecurityConfig configuration = new SecurityConfig();

    @Test
    void productionRequiresAnExplicitJwtSecret() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        assertThrows(IllegalStateException.class,
                () -> configuration.jwtSecretKey("", environment));
    }

    @Test
    void localDevelopmentGeneratesAnEphemeralJwtSecret() {
        byte[] secret = configuration.jwtSecretKey("", new MockEnvironment()).getEncoded();

        assertEquals(32, secret.length);
    }

    @Test
    void productionRejectsWildcardCorsOrigins() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        assertThrows(IllegalStateException.class,
                () -> configuration.corsConfigurationSource("*", environment));
    }

    @Test
    void corsAllowsOnlyConfiguredOrigins() {
        var source = configuration.corsConfigurationSource(
                "https://journal.example,https://journal.example.org", new MockEnvironment());
        var cors = source.getCorsConfiguration(
                new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/incidents"));

        assertTrue(cors.getAllowedOrigins().contains("https://journal.example"));
        assertTrue(cors.getAllowedOrigins().contains("https://journal.example.org"));
        assertEquals(2, cors.getAllowedOrigins().size());
    }
}
