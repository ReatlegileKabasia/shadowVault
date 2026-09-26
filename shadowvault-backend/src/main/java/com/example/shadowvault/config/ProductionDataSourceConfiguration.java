package com.example.shadowvault.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Configuration
@Profile("prod")
public class ProductionDataSourceConfiguration {

    @Bean(destroyMethod = "close")
    @Primary
    DataSource productionDataSource(Environment environment) {
        String configuredUrl = environment.getProperty("SPRING_DATASOURCE_URL");
        if (!isUsable(configuredUrl)) {
            configuredUrl = environment.getProperty("DATABASE_URL");
        }
        if (!isUsable(configuredUrl)) {
            throw new IllegalStateException(
                    "PostgreSQL is not configured. Set SPRING_DATASOURCE_URL to the real JDBC URL "
                            + "or DATABASE_URL to the real Render PostgreSQL connection URL. "
                            + "Do not enter placeholders such as HOST:PORT/DATABASE.");
        }

        DatabaseSettings database = parseDatabaseUrl(configuredUrl);
        String username = firstUsable(
                environment.getProperty("SPRING_DATASOURCE_USERNAME"), database.username());
        String password = firstUsable(
                environment.getProperty("SPRING_DATASOURCE_PASSWORD"), database.password());
        if (username == null || password == null) {
            throw new IllegalStateException(
                    "PostgreSQL credentials are missing. Set SPRING_DATASOURCE_USERNAME and "
                            + "SPRING_DATASOURCE_PASSWORD, or use a DATABASE_URL containing credentials.");
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(database.jdbcUrl());
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(0);
        config.setPoolName("shadowvault-postgres");
        return new HikariDataSource(config);
    }

    static DatabaseSettings parseDatabaseUrl(String configuredUrl) {
        String value = configuredUrl.trim();
        try {
            if (value.startsWith("jdbc:postgresql://")) {
                URI uri = URI.create(value.substring("jdbc:".length()));
                validatePostgresUri(uri, configuredUrl);
                return new DatabaseSettings(value, null, null);
            }

            URI uri = URI.create(value);
            if (!"postgres".equalsIgnoreCase(uri.getScheme())
                    && !"postgresql".equalsIgnoreCase(uri.getScheme())) {
                throw invalidUrl();
            }
            validatePostgresUri(uri, configuredUrl);

            String rawUserInfo = uri.getRawUserInfo();
            String username = null;
            String password = null;
            if (rawUserInfo != null) {
                int separator = rawUserInfo.indexOf(':');
                if (separator < 0) {
                    username = decode(rawUserInfo);
                } else {
                    username = decode(rawUserInfo.substring(0, separator));
                    password = decode(rawUserInfo.substring(separator + 1));
                }
            }

            String jdbcUrl = "jdbc:postgresql://" + uri.getRawAuthority().substring(
                    rawUserInfo == null ? 0 : rawUserInfo.length() + 1)
                    + uri.getRawPath()
                    + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
            return new DatabaseSettings(jdbcUrl, username, password);
        } catch (IllegalArgumentException exception) {
            throw invalidUrl(exception);
        }
    }

    private static void validatePostgresUri(URI uri, String configuredUrl) {
        if (uri.getHost() == null || uri.getHost().isBlank()
                || uri.getPort() < 1
                || uri.getPath() == null
                || uri.getPath().length() < 2
                || uri.getHost().equalsIgnoreCase("host")
                || uri.getPath().equalsIgnoreCase("/DATABASE")) {
            throw invalidUrl();
        }
    }

    private static boolean isUsable(String value) {
        return value != null
                && !value.isBlank()
                && !value.contains("${")
                && !value.equalsIgnoreCase("null")
                && !value.contains("HOST:PORT")
                && !value.toUpperCase(java.util.Locale.ROOT).endsWith("/DATABASE");
    }

    private static String firstUsable(String first, String second) {
        return isUsable(first) ? first.trim() : isUsable(second) ? second : null;
    }

    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    private static IllegalStateException invalidUrl() {
        return new IllegalStateException(
                "Invalid PostgreSQL URL configuration. Use the real Render internal JDBC URL "
                        + "(jdbc:postgresql://host:port/database) or the real postgres:// DATABASE_URL. "
                        + "The value must not contain placeholders.");
    }

    private static IllegalStateException invalidUrl(RuntimeException cause) {
        return new IllegalStateException(
                "Invalid PostgreSQL URL configuration. Use the real Render internal JDBC URL "
                        + "(jdbc:postgresql://host:port/database) or the real postgres:// DATABASE_URL. "
                        + "The value must not contain placeholders.", cause);
    }

    record DatabaseSettings(String jdbcUrl, String username, String password) {
    }
}
