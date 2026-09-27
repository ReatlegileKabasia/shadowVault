package com.example.shadowvault;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ShadowvaultApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	private String firstUsername;
	private String secondUsername;
	private static final String PASSWORD = "correct-horse-battery";

	@BeforeEach
	void createUniqueUsernames() {
		String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
		firstUsername = "first" + suffix;
		secondUsername = "second" + suffix;
	}

	@Test
	void contextLoads() {
	}

	@Test
	void privateRoutesRequireAnAccessToken() throws Exception {
		mockMvc.perform(get("/api/incidents"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/h2-console"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void healthCheckDoesNotRequireAuthentication() throws Exception {
		mockMvc.perform(get("/health"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ok"))
				.andExpect(header().string("X-Content-Type-Options", "nosniff"))
				.andExpect(header().string("X-Frame-Options", "DENY"))
				.andExpect(header().string("Permissions-Policy", "camera=(), microphone=(), geolocation=()"))
				.andExpect(header().string("Referrer-Policy", "no-referrer"));
	}

	@Test
	void rekeyCannotUpdateAnotherUsersIncidents() throws Exception {
		String firstToken = registerAndGetToken(firstUsername);
		String secondToken = registerAndGetToken(secondUsername);
		String incidentResponse = mockMvc.perform(post("/api/incidents")
						.header("Authorization", "Bearer " + firstToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"title":"Private","details":"original-ciphertext","timestamp":"today"}
								"""))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString();
		Matcher idMatcher = Pattern.compile("\"id\":(\\d+)").matcher(incidentResponse);
		if (!idMatcher.find()) {
			throw new AssertionError("Incident response did not contain an ID.");
		}
		String incidentId = idMatcher.group(1);

		mockMvc.perform(put("/api/incidents/" + incidentId)
						.header("Authorization", "Bearer " + firstToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"details":"owner-updated-via-put"}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.details").value("owner-updated-via-put"));

		mockMvc.perform(put("/api/incidents/" + incidentId)
						.header("Authorization", "Bearer " + secondToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"details":"attacker-ciphertext"}
								"""))
				.andExpect(status().isNotFound());

		mockMvc.perform(post("/api/incidents/rekey")
						.header("Authorization", "Bearer " + firstToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"entries":[{"id":%s,"details":"owner-updated-ciphertext"}]}
								""".formatted(incidentId)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.updated").value(1));

		mockMvc.perform(post("/api/incidents/rekey")
						.header("Authorization", "Bearer " + secondToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"entries":[{"id":%s,"details":"attacker-ciphertext"}]}
								""".formatted(incidentId)))
				.andExpect(status().isBadRequest());

		mockMvc.perform(get("/api/incidents")
						.header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].details").value("owner-updated-ciphertext"));
	}

	@Test
	void authenticationRequestsAreRateLimitedByClientAddress() throws Exception {
		for (int attempt = 0; attempt < 20; attempt++) {
			mockMvc.perform(post("/api/auth/login")
							.with(request -> {
								request.setRemoteAddr("198.51.100.29");
								return request;
							})
							.contentType(MediaType.APPLICATION_JSON)
							.content("""
									{"username":"unknown-user","password":"correct-horse-battery"}
									"""))
					.andExpect(status().isUnauthorized());
		}

		mockMvc.perform(post("/api/auth/login")
						.with(request -> {
							request.setRemoteAddr("198.51.100.29");
							return request;
						})
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"username":"unknown-user","password":"correct-horse-battery"}
								"""))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists("Retry-After"));
	}

	@Test
	void oversizedAuthenticationRequestIsRejectedBeforeJsonParsing() throws Exception {
		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("x".repeat(1_048_577)))
				.andExpect(status().is(413));
	}

	@Test
	void usersCanOnlyReadTheirOwnIncidents() throws Exception {
		String firstToken = registerAndGetToken(firstUsername);
		String secondToken = registerAndGetToken(secondUsername);

		mockMvc.perform(post("/api/incidents")
						.header("Authorization", "Bearer " + firstToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"title":"Private","details":"encrypted details","timestamp":"today","userId":999}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("Private"));

		mockMvc.perform(get("/api/incidents")
						.header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].user").doesNotExist());

		mockMvc.perform(get("/api/incidents")
						.header("Authorization", "Bearer " + secondToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void accountDeletionRequiresPasswordAndRemovesOwnedIncidents() throws Exception {
		String token = registerAndGetToken(firstUsername);
		mockMvc.perform(post("/api/incidents")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"title":"Private","details":"encrypted details","timestamp":"today"}
								"""))
				.andExpect(status().isOk());

		mockMvc.perform(delete("/api/auth/me")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"password":"incorrect-password"}
								"""))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/incidents")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));

		mockMvc.perform(delete("/api/auth/me")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"password":"%s"}
								""".formatted(PASSWORD)))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/incidents")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"username":"%s","password":"%s"}
								""".formatted(firstUsername, PASSWORD)))
				.andExpect(status().isOk());
	}

	private String registerAndGetToken(String username) throws Exception {
		String response = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"username":"%s","password":"%s"}
								""".formatted(username, PASSWORD)))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString();

		Matcher matcher = Pattern.compile("\"accessToken\":\"([^\"]+)\"").matcher(response);
		if (!matcher.find()) {
			throw new AssertionError("Registration response did not contain an access token.");
		}
		return matcher.group(1);
	}
}
