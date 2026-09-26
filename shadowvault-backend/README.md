# ShadowVault Backend

Spring Boot REST API for the ShadowVault incident recorder.

## Run locally

Requires Java 17.

```powershell
.\gradlew.bat bootRun
```

The API is available at `http://localhost:8080/api/incidents`.

Local development uses an in-memory H2 database by default. It is not persistent.

## Deploy this repository on Render

The backend is in the `shadowvault-backend` subdirectory of the GitHub repository. In Render, create a **Web Service** (not a Blueprint from the repository root) and configure:

- **Repository:** `ReatlegileKabasia/shadowVault`
- **Root Directory:** `shadowvault-backend`
- **Runtime:** Docker
- **Instance type:** Free
- **Health Check Path:** `/api/incidents`

Render will build `shadowvault-backend/Dockerfile`. The app listens on Render's `PORT` environment variable and uses port 8080 locally.

### Use Render PostgreSQL

Create a PostgreSQL database in Render, then configure these variables on the web service:

- `SPRING_PROFILES_ACTIVE`: `prod`
- `SPRING_DATASOURCE_URL`: `jdbc:postgresql://HOST:PORT/DATABASE`
- `SPRING_DATASOURCE_USERNAME`: the database username
- `SPRING_DATASOURCE_PASSWORD`: the database password

Use the PostgreSQL database's **internal** host, port, and database name when the web service and database are in the same Render region. Render's displayed `postgres://` or `postgresql://` connection URL is not a JDBC URL: convert it to `jdbc:postgresql://HOST:PORT/DATABASE` and set the username and password in their separate variables. Do not commit database credentials to GitHub.

After deployment, copy the service's `https://...onrender.com` URL into `config.js` in the frontend folder. Keep it as the origin only (no `/api/incidents` suffix).

## Data and privacy limitations

The local H2 database is in-memory. In production, PostgreSQL stores incident records across service restarts, subject to the database plan, backups, and retention policy.

The API has no authentication. Anyone who can reach its URL can read incident titles/timestamps and create records. Browser-side encryption of details does not protect titles, and its PIN is part of the public frontend code. Use only synthetic test data until server-side access control and persistent storage are configured. Keep the GitHub repository private if you do not want the source code public.
