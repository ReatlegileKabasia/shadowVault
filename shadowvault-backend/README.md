# ShadowVault Backend

Spring Boot REST API for the ShadowVault incident recorder.

## Run locally

Requires Java 17.

```powershell
.\gradlew.bat bootRun
```

The API is available at `http://localhost:8080/api/incidents`.

Local development uses an in-memory H2 database by default. It is not persistent. If `JWT_SECRET_BASE64` is not set, local development generates a temporary signing key and logs that tokens will not survive an application restart.

The public health endpoint is `GET /health`. Create accounts with `POST /api/auth/register` and sign in with `POST /api/auth/login`; both accept a JSON `username` and `password` and return a bearer token. Usernames are normalized to lowercase; passwords must be 12-72 UTF-8 bytes and are hashed with BCrypt. Authentication routes are limited to 20 requests per client IP per minute by default (`AUTH_REQUESTS_PER_MINUTE` changes this limit). This in-memory limit is per app instance and resets on restart; use a shared rate limiter before scaling to multiple instances. API request bodies are limited to 1 MiB by default; the passcode-rekey endpoint allows up to 16 MiB. These limits are configurable with `MAX_REQUEST_BODY_BYTES` and `MAX_REKEY_BODY_BYTES`. Send `Authorization: Bearer <token>` to `GET` and `POST /api/incidents`. Incident requests contain `title`, `details`, and `timestamp`; the authenticated account is assigned by the server. `PUT /api/incidents/{id}` changes details only for records owned by the authenticated account. `POST /api/incidents/rekey` accepts at most 500 `{id, details}` records and atomically replaces details only when the submitted record set exactly matches the authenticated account's archive.

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
- `SPRING_DATASOURCE_URL`: an actual PostgreSQL JDBC URL from your database provider
- `SPRING_DATASOURCE_USERNAME`: the database username
- `SPRING_DATASOURCE_PASSWORD`: the database password
- alternatively, `DATABASE_URL`: Render's complete PostgreSQL URL (the application converts `postgres://` / `postgresql://` to JDBC and reads its credentials)
- `JWT_SECRET_BASE64`: a private, randomly generated Base64 secret containing at least 32 random bytes
- `APP_CORS_ALLOWED_ORIGINS`: the exact HTTPS origin serving the frontend, for example `https://your-site.example`
- `AUTH_REQUESTS_PER_MINUTE`: optional per-instance login/registration limit (default `20`)

Prefer linking the Render PostgreSQL database to the web service so Render supplies its internal `DATABASE_URL`. Alternatively, copy the real JDBC URL shown by your database provider into `SPRING_DATASOURCE_URL` and set the username and password separately. The application also accepts a real `postgres://` or `postgresql://` value in `DATABASE_URL` and converts it to JDBC. Never enter tutorial placeholders in environment variables; the application rejects common placeholder values. Do not commit database credentials to GitHub.

Generate a JWT secret locally with `openssl rand -base64 48`; enter the output directly in Render's `JWT_SECRET_BASE64` environment variable. Do not use the development-only signing key outside local development.

After deployment, copy the service's `https://...onrender.com` URL into `config.js` in the frontend folder. Keep it as the origin only (no `/api/incidents` suffix).

Production CORS rejects `*`; set `APP_CORS_ALLOWED_ORIGINS` to the exact HTTPS origin of the hosted frontend, without a path or trailing slash. If you change the backend hostname, update both `config.js` and the frontend Content-Security-Policy in `index.html` and `_headers`. Static hosts that support `_headers` will send the frontend security headers; keep the matching CSP meta policy in place for other static hosts.

## Data and privacy limitations

The local H2 database is in-memory. In production, PostgreSQL stores incident records across service restarts, subject to the database plan, backups, and retention policy. The production profile validates the existing database schema instead of making automatic schema changes; use a reviewed database migration when the schema needs to change.

Accounts use BCrypt password hashes and signed, expiring bearer tokens. Incident records are scoped to the account in the verified token; clients cannot select another account by sending a user ID. Tokens are kept in frontend memory and expire after one hour. Users must sign in again after reloading the page. Old incident rows created before accounts were added have no owner and are not returned to any account.

The calculator passcode is a per-account, per-browser local unlock, not account authentication or account recovery. New passcode verifiers use a random salt and PBKDF2; old SHA-256 verifiers are upgraded after a successful unlock. New incident ciphertext uses AES-GCM with a stronger PBKDF2 work factor; older `sv1` entries remain readable using the original passcode, which must now be entered explicitly if it differs from the current one. Choose a passcode of at least eight calculator-key characters; expressions are supported. Changing a passcode re-encrypts the complete account archive (up to 500 entries in one atomic operation); use the same new passcode on other devices. The frontend can also update a device's local passcode when the archive has already been re-encrypted elsewhere. Forgetting the correct passcode can make encrypted incident details unrecoverable. Browser-side encryption protects incident details, but titles and timestamps remain visible to the server. The API needs an internet connection to sync data. Keep the repository private if you do not want source code public.
