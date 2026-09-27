# ShadowVault Privacy, Safety, and Legal Readiness

**Status: not a legal opinion and not evidence that ShadowVault is compliant worldwide.** No software change can make an operator immune from lawsuits or satisfy every jurisdiction automatically. Applicable duties depend on the operator, user locations and ages, product claims, business model, vendors, and actual data practices. Have qualified counsel review the service before offering it publicly.

## Current product facts reviewed

- ShadowVault is a browser-based private journal with calculator-style entry, account login, encrypted incident details, and a Spring Boot/PostgreSQL sync service. No microphone, camera, geolocation, advertising, or analytics integration was found in the reviewed frontend.
- The frontend derives an AES-GCM encryption key from a local calculator passcode and encrypts new entry details before syncing. The browser stores a salted PBKDF2 passcode verifier in local storage. The passcode and derived keys are not sent as part of the normal save flow.
- Account usernames, entry titles, timestamps, and ciphertext are sent to and stored by the backend. Legacy details may be unencrypted. Anyone controlling the browser/device, or able to modify the delivered frontend code, may be able to access plaintext while the vault is open. This is not a claim of independently audited end-to-end encryption.
- The backend uses BCrypt password hashes, bearer JWTs held in frontend memory, owner-scoped incident access, and PostgreSQL. The previously configured Render database was in Oregon; the frontend static-hosting provider, all subprocessors, log retention, and backup deletion schedule have not been confirmed.
- The app includes local export of decrypted entries as a readable JSON file. Users can delete an account after confirming its password; this deletes that account and its entries from the active application database. It does not establish when provider backups, logs, browser downloads, or other copies are deleted.
- Quick exit now hides the vault and clears in-memory account/PIN state without navigating to a third-party site. It does not erase browser history, screen captures, device activity, notifications, or network records.
- A verified manual database export was made by the operator on 2026-09-27. It is a separate plaintext-equivalent risk if it contains readable metadata or is restored; secure it and set a retention/deletion date.

## Implemented in the reviewed code

- Backend account deletion is authenticated, requires re-entering the account password, and deletes the signed-in account's incident rows and account record in one transaction. It does not accept a user ID from the client.
- The frontend offers a warning before exporting plaintext JSON and reports decryption failure rather than generating an incomplete export.
- The frontend explains that titles and timestamps are visible, legacy entries may be unencrypted, no emergency monitoring is provided, and deletion does not promise backup/log erasure.
- Logout, quick exit, and expired sessions clear in-memory access tokens, PINs, and derived-key references. Quick exit no longer makes an outbound request to Google.
- Backend tests cover wrong-password denial, deletion of the account's entries, invalidation of the prior token, and reuse of the deleted username.

## Launch blockers and operator decisions

These cannot be truthfully completed from code alone. Resolve them before describing the app as compliant or making public privacy/security promises:

1. **Operator identity and contact:** specify the legal operator/controller, a monitored privacy/support contact, and any representative required in target markets.
2. **Markets and audience:** choose launch countries, determine whether access is restricted, define intended minimum age, assess actual use by minors, and decide whether children can create accounts. Do not assume a generic age checkbox solves child-privacy duties.
3. **Full privacy notice and terms:** publish a complete, accessible notice before account creation. Identify collected data, purposes, legal bases where applicable, recipients/processors, locations/transfers, retention, user rights and request channel, complaint route, and security limits. Add terms of service and safety limitations reviewed by counsel. The in-app summary is not a substitute.
4. **Retention and deletion:** set periods for active database data, account metadata, backups, infrastructure logs, support records, and exports. Verify provider backup expiration/deletion in writing. Test deletion through every system and document legal-hold exceptions. Orphaned records without an account owner, if any, need an operator-controlled cleanup plan.
5. **Vendor and transfer diligence:** identify the static host, Render services, database region, subprocessors, monitoring/support access, and all data flows. Review data-processing agreements, security commitments, subprocessors, breach-notice timing, and applicable international-transfer mechanisms.
6. **Rights and incident operations:** create a process for access, correction, deletion, portability, objection/opt-out where applicable, and identity verification. Create a breach plan covering containment, records, vendor escalation, and jurisdiction-specific regulator/user notices.
7. **Risk assessment and safety:** assess whether a privacy/DPIA or equivalent assessment is required; threat-model shared devices, coercive access, account recovery, exports, and emergency use. Do not claim alerts, evidence preservation, anonymity, confidentiality from the operator, or emergency response unless verified.
8. **Accessibility and distribution:** test keyboard/screen-reader use and contrast. If distributing through app stores or offering a regulated service, map their current contractual requirements separately.
9. **Security operations:** document secret rotation, dependency updates, database backup/restore tests, access reviews, production monitoring, incident ownership, and vulnerability response. Per-instance in-memory rate limits are not a shared control across multiple backend instances.
10. **Free database lifecycle:** the Render dashboard showed the PostgreSQL Free instance scheduled for deletion on 2026-10-26 unless upgraded. Confirm migration/export and deletion behavior well before that date; a local dump is not a tested restore.

Draft materials are in `docs/PRIVACY-NOTICE-DRAFT.md`, `docs/TERMS-DRAFT.md`, `docs/DATA-OPERATIONS-PLAN.md`, and `docs/INCIDENT-RESPONSE-RUNBOOK.md`. They intentionally contain required decision fields and must not be treated as final or published unchanged.

## Legal issue-spotting by market

This is a map for counsel, not a determination that a law applies:

- **EU/EEA:** assess GDPR territorial scope, lawful basis for each purpose, any Article 9 condition for special-category data, data-subject rights, controller/processor roles, records and retention, security, cross-border transfers, and whether a DPIA is required. Journal entries can reveal sensitive information even if the UI does not ask for it.
- **United Kingdom:** separately assess UK GDPR and Data Protection Act 2018 requirements, special-category/criminal-offence conditions, rights, transfers, and regulator notification.
- **California:** determine whether the operator is a covered CCPA/CPRA business under current thresholds and definitions; if so, assess notice, access/correction/deletion, sensitive-information controls, sale/sharing opt-outs where relevant, contracts, and retention requirements.
- **Other U.S. states:** assess each applicable comprehensive privacy statute and breach-notification law. Applicability, sensitive-data rules, exemptions, deadlines, and notice recipients vary.
- **Children:** assess COPPA if the service is directed to children under 13 or has actual knowledge of such users; separately assess EU/UK child rules and each target country's age requirements.
- **Health information:** HIPAA does not automatically apply merely because users write about health. Assess covered-entity/business-associate relationships and the FTC Health Breach Notification Rule if the product's functionality and relationships bring it within scope.
- **Consumer protection:** substantiate statements such as "private," "encrypted," "secure," or "safe" against the complete product and vendor chain. Inaccurate claims or omitted limitations can be independently risky.
- **Recording laws:** no recording feature was found. Before adding audio/video or covert capture, get location-specific advice on consent, notice, interception, and evidence rules.
- **Accessibility and app stores:** determine whether accessibility statutes/service categories apply. App-store privacy labels, account-deletion duties, SDK rules, and review policies apply only if/when distributing through those platforms, but platform terms may still be binding.

## Primary-source starting points

- EU GDPR text, including Articles 3–6, 9–10, 12–22, 25, 28, 32–35, and 44–49: <https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng>
- UK ICO lawful-basis guidance: <https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/>
- UK Data Protection Act 2018: <https://www.legislation.gov.uk/ukpga/2018/12/contents>
- California Civil Code §1798.140 (definitions and coverage): <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.140.&lawCode=CIV>
- California Civil Code §§1798.100, .105, .121, .130, .135 (notice and rights; verify current text): <https://leginfo.legislature.ca.gov/faces/codes.xhtml?tocCode=CIV&tocTitle=+Civil+Code+-+CIV>
- California breach-notice statute, Civil Code §1798.82: <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.82.&lawCode=CIV>
- COPPA, 16 C.F.R. Part 312: <https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312>
- FTC Health Breach Notification Rule, 16 C.F.R. Part 318: <https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-318>
- HIPAA definition of covered entity/business associate, 45 C.F.R. §160.103: <https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-160/section-160.103>
- U.S. FTC Act §5, 15 U.S.C. §45: <https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section45&num=0&edition=prelim>
- U.S. Department of Justice web accessibility guidance: <https://www.ada.gov/resources/web-guidance/>
- European Accessibility Act, Directive (EU) 2019/882: <https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng>
- WCAG 2.2 (engineering reference, not a universal legal determination): <https://www.w3.org/TR/WCAG22/>
- Render regions and hosting context: <https://render.com/docs/regions>
- Google Play User Data policy (only if distributing there): <https://support.google.com/googleplay/android-developer/answer/10144311>
- Apple App Review Guidelines (only if distributing there): <https://developer.apple.com/app-store/review/guidelines/>

Review each primary source for amendments and local applicability at launch. This checklist is not exhaustive of every country's laws and must not be presented as a certification.
