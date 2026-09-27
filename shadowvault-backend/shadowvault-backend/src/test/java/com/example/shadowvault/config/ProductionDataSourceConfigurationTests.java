package com.example.shadowvault.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProductionDataSourceConfigurationTests {

    @Test
    void acceptsJdbcPostgresUrl() {
        ProductionDataSourceConfiguration.DatabaseSettings settings =
                ProductionDataSourceConfiguration.parseDatabaseUrl(
                        "jdbc:postgresql://db.example.internal:5432/vault");

        assertEquals("jdbc:postgresql://db.example.internal:5432/vault", settings.jdbcUrl());
        assertEquals(null, settings.username());
        assertEquals(null, settings.password());
    }

    @Test
    void convertsRenderPostgresUrlToJdbcUrlAndCredentials() {
        ProductionDataSourceConfiguration.DatabaseSettings settings =
                ProductionDataSourceConfiguration.parseDatabaseUrl(
                        "postgresql://vault-user:p%40ss%2Bword@db.example.internal:5432/vault?sslmode=require");

        assertEquals(
                "jdbc:postgresql://db.example.internal:5432/vault?sslmode=require",
                settings.jdbcUrl());
        assertEquals("vault-user", settings.username());
        assertEquals("p@ss+word", settings.password());
    }

    @Test
    void convertsRenderPostgresUrlWithoutExplicitPort() {
        ProductionDataSourceConfiguration.DatabaseSettings settings =
                ProductionDataSourceConfiguration.parseDatabaseUrl(
                        "postgres://vault-user:secret@db.example.internal/vault");

        assertEquals("jdbc:postgresql://db.example.internal/vault", settings.jdbcUrl());
        assertEquals("vault-user", settings.username());
        assertEquals("secret", settings.password());
    }

    @Test
    void rejectsUnreplacedRenderPlaceholders() {
        assertThrows(IllegalStateException.class,
                () -> ProductionDataSourceConfiguration.parseDatabaseUrl(
                        "jdbc:postgresql://HOST:PORT/DATABASE"));
    }
}
