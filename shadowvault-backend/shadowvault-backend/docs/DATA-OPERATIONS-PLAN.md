# ShadowVault Data Operations Plan — Completion required before launch

**Status: operational draft, not an implemented retention schedule.** Do not publish a period or deletion promise until the setting is configured and tested with each provider.

## Data inventory and system map

| Data / system | Evidence from reviewed code | Storage/recipient known | Required operator verification |
|---|---|---|---|
| Username and BCrypt password hash | Registration/login API and `User` entity | PostgreSQL backend; Render dashboard showed Oregon | Confirm DB region, provider access, logs, backup scope, credential-access roles |
| Entry title and timestamp | Frontend sends as plaintext fields; `Incident` entity | PostgreSQL backend | Confirm DB/log/backup handling and why each field is needed |
| New entry details | Browser encrypts to AES-GCM ciphertext before ordinary sync | Browser then PostgreSQL; backend receives ciphertext | Verify legacy rows, request-body logs, backups, support access, frontend integrity |
| Local passcode verifier | PBKDF2 verifier in browser local storage | User's browser profile | Explain shared-device risk; test local cleanup and browser behavior |
| Access token | Held in frontend memory, expires per backend configuration | Browser runtime and request headers | Confirm no URL/log/cache exposure; test logout and account deletion |
| IP/request/availability data | Framework/provider processing is possible; app code has auth throttling | Render/static host/CDN providers unknown | Obtain provider documentation, contracts, region and retention details |
| Export and database dump | User can export plaintext JSON; operator created a manual dump | User/operator-controlled devices | Define encryption, access, retention, deletion, and restore handling |

## Retention schedule worksheet

Fill with a definite duration or event and verify technical behavior. "As needed" is not a schedule.

| Category | Proposed period/event | Owner | Implemented/tested? |
|---|---|---|---|
| Active account and records | `[DECIDE: deletion request and lawful exceptions]` | Operator | No end-to-end schedule verified |
| Orphaned/unowned legacy incidents | `[INVENTORY and decide safe handling]` | Operator | Unknown |
| Database backups/provider recovery | `[GET current Render plan and expiration/deletion behavior]` | Operator + Render | Free plan reported no built-in export/backup; verify current state |
| Application/security logs | `[GET provider retention and minimize content]` | Operator + providers | Unknown |
| Static-host/CDN logs and caches | `[IDENTIFY host and retention]` | Operator + provider | Unknown |
| User plaintext downloads | User-controlled; warn and avoid app-side claim of erasure | User | Export warning implemented |
| Operator-created database dump | `[Set a secure storage location and destruction date]` | Operator | Backup file created; future disposition unverified |
| Support/rights-request records | `[Minimize content and set purpose-based period]` | Operator | Process/contact not set |

### Required lifecycle controls

1. Inventory all rows and backups, including records without an owner, before deleting or migrating anything.
2. Test account deletion on a non-production database: wrong password fails; correct password removes account and owned records; tokens no longer work; rollback preserves data if the transaction fails.
3. Obtain provider backup-expiry, log-retention, and account-termination details in writing. A database row deletion is not proof that backups or logs have been erased.
4. Restrict and log access to production data; do not copy live journal contents into tickets or analytics.
5. Encrypt operator exports at rest, limit access, record creation date/purpose, test restore in an isolated environment, and securely delete when no longer needed.
6. Recheck Render's Free PostgreSQL expiration date and migrate/export before the provider's deletion deadline. Verify the dump with an actual restore test, not only an archive listing.

## Vendor/subprocessor register

| Provider/service | Role/data | Region(s) | DPA/security terms reviewed? | Retention/subprocessors | Action |
|---|---|---|---|---|---|
| Render backend | Backend requests, accounts/metadata, encrypted details | `[verify service region]` | `[confirm]` | `[confirm logs/support/subprocessors]` | Obtain current terms and security/privacy docs |
| Render PostgreSQL | Account records, titles, timestamps, ciphertext and legacy rows | Oregon was shown in dashboard; reverify | `[confirm]` | `[confirm backups and Free-plan expiry]` | Plan migration before expiry |
| Frontend host/CDN | Static files, visitor network/request metadata | Unknown | Unknown | Unknown | Identify host and verify logs/CDN behavior |
| Email/analytics/error/payment/support | None found in reviewed source; provider use unverified | Unknown | Unknown | Unknown | Confirm none or enumerate every provider |

For each provider, record legal entity, service, data, processing instructions, locations, subprocessors, security measures, incident-notice time, rights-request assistance, deletion/return, and international-transfer terms.

## Rights-request workflow

1. Accept requests at **[REQUIRED monitored contact/URL]** and assign a case ID without putting journal text in the case title.
2. Acknowledge and identify request type, jurisdiction, deadline, and any extension rules with counsel-reviewed jurisdiction matrix.
3. Verify the requester proportionately; never ask for the calculator passcode or plaintext entries to prove identity.
4. Retrieve only the requester's account data; assess third-party information and legal exceptions with counsel.
5. For access/export, use the in-app export after verifying account ownership and explain that it is plaintext. Provide any other format required by law.
6. For deletion, execute authenticated account deletion, track backup/log copies and exceptions, and communicate what is deleted versus retained and why.
7. Record decision, completion date, system/provider actions, and any appeal path. Delete the request record according to its own schedule.
8. Before launch, set contact, owners, systems, identity checks, jurisdiction deadlines, appeal process, and escalation coverage; dry-run each request type.

## Age and launch-market decision log

- Intended age: `[REQUIRED: operator decision after child-safety/privacy review]`.
- Actual age verification/assurance: none in current UI/backend.
- Launch countries and geoblocking: `[REQUIRED]`.
- COPPA/EU/UK and other local child-rule analysis: `[REQUIRED counsel review]`.
- Decision owner/date/evidence: `[REQUIRED]`.

Do not describe users as "18+" or say children are blocked until the policy is chosen and an effective, tested process exists.
