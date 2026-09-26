package com.example.shadowvault.service;

import com.example.shadowvault.dto.AuthRequest;
import com.example.shadowvault.dto.AuthResponse;
import com.example.shadowvault.model.User;
import com.example.shadowvault.repository.UserRepository;
import com.example.shadowvault.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse register(AuthRequest request) {
        String username = normalizeUsername(request.username());
        if (!username.matches("[a-z0-9_.-]{3,32}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Username must be 3-32 characters using letters, numbers, '.', '_' or '-'.");
        }
        validatePassword(request.password());
        if (users.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already registered.");
        }

        User user = users.save(new User(username, passwordEncoder.encode(request.password())));
        return createResponse(user);
    }

    public AuthResponse login(AuthRequest request) {
        String username = normalizeUsername(request.username());
        User user = users.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid username or password."));
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Invalid username or password.");
        }
        return createResponse(user);
    }

    private AuthResponse createResponse(User user) {
        return new AuthResponse(jwtService.issueToken(user), "Bearer",
                jwtService.getExpirationSeconds(), user.getUsername());
    }

    private String normalizeUsername(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }

    private void validatePassword(String password) {
        if (password.length() < 12 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Password must be at least 12 characters and at most 72 UTF-8 bytes.");
        }
    }
}
