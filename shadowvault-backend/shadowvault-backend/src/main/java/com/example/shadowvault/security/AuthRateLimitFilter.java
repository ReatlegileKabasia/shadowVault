package com.example.shadowvault.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 60_000;
    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final int requestsPerMinute;

    public AuthRateLimitFilter(int requestsPerMinute) {
        if (requestsPerMinute < 1) {
            throw new IllegalArgumentException("The authentication rate limit must be positive.");
        }
        this.requestsPerMinute = requestsPerMinute;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !("POST".equalsIgnoreCase(request.getMethod())
                && ("/api/auth/login".equals(path) || "/api/auth/register".equals(path)));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        long now = System.currentTimeMillis();
        long windowStart = now / WINDOW_MILLIS * WINDOW_MILLIS;
        String clientAddress = request.getRemoteAddr();
        String key = clientAddress == null || clientAddress.isBlank() ? "unknown" : clientAddress;
        boolean[] allowed = {true};
        synchronized (windows) {
            if (windows.size() >= MAX_TRACKED_CLIENTS) {
                windows.entrySet().removeIf(
                        entry -> now - entry.getValue().startMillis() >= WINDOW_MILLIS);
            }
            if (!windows.containsKey(key) && windows.size() >= MAX_TRACKED_CLIENTS) {
                allowed[0] = false;
            } else {
                windows.compute(key, (address, existing) -> {
                    if (existing == null || existing.startMillis() != windowStart) {
                        return new Window(windowStart, 1);
                    }
                    if (existing.count() >= requestsPerMinute) {
                        allowed[0] = false;
                        return existing;
                    }
                    return new Window(windowStart, existing.count() + 1);
                });
            }
        }

        if (!allowed[0]) {
            long retryAfterSeconds = Math.max(1, (windowStart + WINDOW_MILLIS - now + 999) / 1000);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", Long.toString(retryAfterSeconds));
            response.setHeader("Cache-Control", "no-store");
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"error\":\"Too many authentication attempts. Try again shortly.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private record Window(long startMillis, int count) {
    }
}
