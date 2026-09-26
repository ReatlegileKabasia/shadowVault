# ShadowVault Backend

Spring Boot REST API for the ShadowVault incident recorder.

## Run locally

Requires Java 17.

```powershell
.\gradlew.bat bootRun
```

The API is available at `http://localhost:8080/api/incidents`.

Local development uses an in-memory H2 database by default. It is not persistent.

The public health endpoint is `GET /health`. Create accounts with `POST /api/auth/register` and sign in with `POST /api/auth/login`; both accept a JSON `username` and `password` and return a bearer token. Usernames are normalized to lowercase; passwords must be 12-72 UTF-8 bytes. Send `Authorization: Bearer <token>` to `GET` and `POST /api/incidents`. Incident requests contain `title`, `details`, and `timestamp`; the authenticated account is assigned by the server.

## Deploy this repository on Render

The backend is in the `shadowvault-backend` subdirectory of the GitHub repository. In Render, create a **Web Service** and configure:

- **Repository:** `ReatlegileKabasia/shadowVault`
- **Root Directory:** leave blank
- **Runtime:** Docker
- **Docker Build Context Directory:** `shadowvault-backend`
- **Dockerfile Path:** `shadowvault-backend/Dockerfile`
- **Instance type:** Free
- **Health Check Path:** `/health`

Render will build the backend directory's `Dockerfile`. The container always enables the production profile, so it requires the PostgreSQL and security variables below before starting. The app listens on Render's `PORT` environment variable and uses port 8080 locally.

### Use Render PostgreSQL

Create a PostgreSQL database in Render, then configure these variables on the web service:

- `SPRING_PROFILES_ACTIVE`: `prod`
- `SPRING_DATASOURCE_URL`: `jdbc:postgresql://HOST:PORT/DATABASE`
- `SPRING_DATASOURCE_USERNAME`: the database username
- `SPRING_DATASOURCE_PASSWORD`: the database password
- alternatively, `DATABASE_URL`: Render's complete PostgreSQL URL (the application converts `postgres://` / `postgresql://` to JDBC and reads its credentials)
- `JWT_SECRET_BASE64`: a private, randomly generated Base64 secret containing at least 32 random bytes
- `APP_CORS_ALLOWED_ORIGINS`: the exact HTTPS origin serving the frontend, for example `https://your-site.example`

Prefer linking the Render PostgreSQL database to the web service so Render supplies its internal `DATABASE_URL`. Alternatively, set `SPRING_DATASOURCE_URL` to an actual JDBC URL (`jdbc:postgresql://real-host:5432/real-database`) and set the username and password separately. The application also accepts a real `postgres://` or `postgresql://` value in `DATABASE_URL` and converts it to JDBC. Never enter sample text such as `HOST`, `PORT`, or `DATABASE`; the application detects these placeholders and exits with a clear configuration error. Do not commit database credentials to GitHub.

Generate a JWT secret locally with `openssl rand -base64 48`; enter the output directly in Render's `JWT_SECRET_BASE64` environment variable. Do not use the development-only signing key outside local development.

After deployment, copy the service's `https://...onrender.com` URL into `config.js` in the frontend folder. Keep it as the origin only (no `/api/incidents` suffix).

## Data and privacy limitations

The local H2 database is in-memory. In production, PostgreSQL stores incident records across service restarts, subject to the database plan, backups, and retention policy.

Accounts use BCrypt password hashes and signed, expiring bearer tokens. Incident records are scoped to the account in the verified token; clients cannot select another account by sending a user ID. Tokens are kept in frontend memory and expire after one hour. Users must sign in again after reloading the page. Old incident rows created before accounts were added have no owner and are not returned to any account.

The calculator passcode is a per-account, per-browser local unlock, not account authentication or account recovery. Its SHA-256 hash is stored in that browser's local storage, so short numeric passcodes can be guessed offline. Choose a longer passcode. Forgetting an account's passcode can make its encrypted incident details unrecoverable. Browser-side encryption protects incident details, but titles and timestamps remain visible to the server. The API needs an internet connection to sync data. Keep the repository private if you do not want source code public.
