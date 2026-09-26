# ShadowVault Backend

Spring Boot REST API for ShadowVault incidents.

## Run locally

Requires Java 17.

```powershell
.\gradlew.bat bootRun
```

The API is available at `http://localhost:8080/api/incidents`.

## Deploy on Render

1. Push this directory to a GitHub repository named `shadowvault-backend`.
2. In Render, create a new **Blueprint** and select that repository.
3. Render reads `render.yaml` and builds the Docker image from `Dockerfile`.
4. Once the service is live, check `https://<your-service>.onrender.com/api/incidents`.

The server listens on Render's `PORT` environment variable and uses port 8080 locally.

The current H2 database is in-memory. Its data is lost when the service restarts or spins down; use a persistent database if incident records must survive.
