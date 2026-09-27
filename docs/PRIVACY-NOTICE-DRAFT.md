# ShadowVault Privacy Notice — Draft for operator and counsel review

**DRAFT — DO NOT PUBLISH AS FINAL.** Complete every `[REQUIRED: ...]` field, verify every product/vendor statement, select launch markets and age policy, and obtain qualified review. This template is not legal advice and does not itself establish compliance.

**Last verified against code:** 2026-09-27  
**Effective date:** `[REQUIRED: date after review]`

## Who operates ShadowVault

ShadowVault is operated by **[REQUIRED: full legal name and legal form]**, located at **[REQUIRED: business or service address where legally required]**.

Privacy questions and rights requests: **[REQUIRED: monitored privacy email or request URL]**.  
Support contact: **[REQUIRED: monitored support contact]**.  
EU/UK representative or data protection officer, if required: **[REQUIRED: details or documented determination that not required]**.

Do not launch until these contacts are real, monitored, and tested.

## Who may use the service

**[REQUIRED: choose a minimum age and the countries in which the service is offered.]** The current app does not verify age. Do not claim that children are excluded or that parental consent is collected unless an age-appropriate process is implemented and tested. If the product is directed to children or the operator knows children are using it, pause launch and get specialist child-privacy advice.

## Information the service handles

Based on the current application code:

- **Account information:** username and a BCrypt password hash. The backend does not store the plaintext account password after processing the request.
- **Journal records:** entry title, timestamp, and details. The browser encrypts details for new entries before sync; the service receives and stores the encrypted details. Titles and timestamps are sent to and readable by the service.
- **Legacy entries:** older entries may contain readable, unencrypted details. Users should review and re-encrypt or delete those entries.
- **Network and operational information:** the hosting, database, static-hosting, and network providers may process IP addresses, request metadata, error/availability data, and security logs. **[REQUIRED: verify each provider's actual collection, access, location, and retention.]**
- **Local browser information:** a salted passcode verifier is kept in browser local storage. The passcode and derived key are used locally by the browser for entry encryption. Do not describe this as independently audited end-to-end encryption.
- **Exports and backups:** a user-initiated export is a readable JSON file on the user's device. Database backups and operator-created exports may contain account metadata, titles, timestamps, and encrypted details, plus any legacy readable details.

The reviewed app code does not currently integrate analytics, advertising SDKs, microphone, camera, or geolocation. Re-check this statement after every dependency or feature change and verify the static host and deployment platform separately.

## Why information is used

Current intended functions are account creation/sign-in, authentication and abuse prevention, storing/syncing records, displaying the user's archive, account deletion, exports, service security, and troubleshooting. **[REQUIRED: identify and approve the lawful basis/purpose for each activity in each launch jurisdiction; do not copy a generic basis without analysis.]**

The app does not currently offer emergency monitoring or send emergency alerts. Do not use journal entries for a new purpose without updating the product, notice, and legal assessment.

## Encryption and access limits

New entry details are encrypted in the browser with AES-GCM using a key derived from a local calculator passcode. The API receives the ciphertext, not the passcode, in the ordinary save flow. The backend can read account usernames, titles, timestamps, and ciphertext. The frontend code is delivered to users by the static host; users who control or can modify the device/browser may access plaintext while the vault is open. Old records may not be encrypted. A lost passcode can make encrypted details unrecoverable.

No independent security audit or penetration test is claimed. TLS, provider access controls, backups, logs, and support access must be verified with each provider. Avoid claims that the operator can never access user data unless this is independently validated across the entire system and its update chain.

## Who receives information and where it is processed

**[REQUIRED: name every provider and service actually used, its role, data received, region, subprocessors, and contract status.]**

Known from configuration/history but not independently verified as a full vendor inventory:

- Render hosts the backend and PostgreSQL service; the database has been shown in the Render dashboard as Oregon, United States.
- The public frontend host and its CDN are not identified in the reviewed repository.
- Email, analytics, support, error-reporting, payment, or other providers: **[REQUIRED: confirm none or list each.]**

International transfer mechanisms and assessments: **[REQUIRED: determine and document for each market/provider.]**

## Retention, deletion, and copies

There is no verified, fully configured end-to-end retention schedule in the reviewed code. **[REQUIRED: set and implement periods for active accounts/entries, provider logs, backups, support records, database exports, and disaster-recovery copies.]**

Users can request deletion through **Delete account and entries** after re-entering their account password. The current implementation deletes the account and its incident rows from the active application database in one transaction. It cannot erase copies previously exported or promise immediate deletion from provider backups, logs, caches, or a separate operator-created backup.

The operator must define how rights requests are handled, applicable exceptions, backup expiration, and how orphaned/unowned legacy rows are addressed. The Render dashboard previously indicated that the Free database would expire on 2026-10-26; verify its current status and migrate/export data before any provider deletion.

## User choices and rights

Depending on jurisdiction and applicable exceptions, users may have rights to access, correct, delete, export/port, object, restrict, withdraw consent, or complain to a regulator. **[REQUIRED: list the rights that actually apply to each market and the process/deadlines.]**

Submit requests to **[REQUIRED: monitored contact]**. Do not request more identity evidence than needed. The operator must verify request authority, protect third-party data in entries, track deadlines, document decisions, and provide any required appeal or complaint process.

## Security incidents

Report suspected account compromise or privacy incidents to **[REQUIRED: monitored incident contact]**. The operator will assess incidents and provide notices when required by applicable law. Do not state a universal notice deadline: deadlines and triggers differ by jurisdiction. See the internal `docs/INCIDENT-RESPONSE-RUNBOOK.md`.

## Changes and complaints

Notice changes take effect **[REQUIRED: define effective date and how users will be informed]**. Complaints may be sent to **[REQUIRED: contact and applicable regulator/authority information]**.

## Before publication checklist

- [ ] Replace every `[REQUIRED: ...]` item and verify all provider statements.
- [ ] Complete jurisdiction-specific lawful-basis, sensitive-data, age, transfer, and rights analysis.
- [ ] Confirm actual log, backup, support, CDN, and export retention with providers.
- [ ] Ensure the notice is accessible before account registration and available in required languages.
- [ ] Review the implementation and notice together after any data-flow or SDK change.
- [ ] Obtain local privacy counsel review and record approval/version date.
