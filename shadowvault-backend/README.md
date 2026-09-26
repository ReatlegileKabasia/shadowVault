# ShadowVault Backend

Spring Boot REST API for the ShadowVault incident recorder.

## Run locally

Requires Java 17.

```powershell
.\gradlew.bat bootRun
```

The API is available at `http://localhost:8080/api/incidents`.

## Deploy this repository on Render

The backend is in the `shadowvault-backend` subdirectory of the GitHub repository. In Render, create a **Web Service** (not a Blueprint from the repository root) and configure:

- **Repository:** `ReatlegileKabasia/shadowVault`
- **Root Directory:** `shadowvault-backend`
- **Runtime:** Docker
- **Instance type:** Free
- **Health Check Path:** `/api/incidents`

Render will build `shadowvault-backend/Dockerfile`. The app listens on Render's `PORT` environment variable and uses port 8080 locally.

After deployment, copy the service's `https://...onrender.com` URL into `config.js` in the frontend folder. Keep it as the origin only (no `/api/incidents` suffix).

## Data and privacy limitations

The current H2 database is in-memory. All incident records are lost when the service restarts or spins down; add a persistent database before relying on it.

The API has no authentication. Anyone who can reach its URL can read incident titles/timestamps and create records. Browser-side encryption of details does not protect titles, and its PIN is part of the public frontend code. Use only synthetic test data until server-side access control and persistent storage are configured. Keep the GitHub repository private if you do not want the source code public.
