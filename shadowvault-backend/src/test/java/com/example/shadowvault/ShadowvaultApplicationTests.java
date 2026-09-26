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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
	void incidentsRequireAnAccessToken() throws Exception {
		mockMvc.perform(get("/api/incidents"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void healthCheckDoesNotRequireAuthentication() throws Exception {
		mockMvc.perform(get("/health"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ok"));
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
