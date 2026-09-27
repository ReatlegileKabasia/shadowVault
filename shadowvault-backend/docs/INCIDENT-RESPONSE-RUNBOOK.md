# ShadowVault Security and Privacy Incident Runbook

**Draft for operator assignment and tabletop testing.** This is an internal procedure, not a promise of a particular notice deadline. Applicable reporting obligations vary by jurisdiction, affected data, risk, and operator role.

## Preparation (complete before public launch)

- Incident lead: `[REQUIRED: named person and backup]`
- Privacy/legal escalation: `[REQUIRED: counsel and contact route]`
- Provider security contacts and contract-required notice windows: `[REQUIRED: Render, static host/CDN, and every other provider]`
- Secure evidence location and access list: `[REQUIRED]`
- User/regulator notice channels and accessible templates: `[REQUIRED]`
- On-call/contact coverage and authority to disable registration/API: `[REQUIRED]`
- Current backup/restore procedure and tested recovery point: `[REQUIRED]`

Keep an offline/private copy of this runbook and provider contacts. Never store passwords, JWT secrets, or journal contents in the runbook.

## When an incident is suspected

Examples include exposed credentials, unauthorized account access, data sent to the wrong user, database/public bucket exposure, malicious frontend/dependency change, lost operator export, or provider breach.

1. **Report and start a record.** Capture time detected, reporter, systems involved, and observed facts. Use a neutral case ID; do not paste secrets or entry contents into chat/tickets.
2. **Contain safely.** Revoke exposed JWT/database/provider credentials; disable affected endpoints or registration if needed; restrict provider/network access; preserve a secure evidence copy before changing state where feasible. Do not destroy evidence or disable a system before considering user-safety/availability impacts.
3. **Escalate promptly.** Contact the incident lead, privacy/legal adviser, and affected providers using verified contacts. Record when each provider was notified and its response.
4. **Establish scope.** Determine systems, time window, users, data categories, whether content was ciphertext or plaintext, key/device exposure, access evidence, copies/backups, and whether vulnerable users could face physical or emotional danger. Distinguish confirmed facts from unknowns.
5. **Protect people.** Consider coercive access and whether a notice could increase danger. Get jurisdiction-appropriate privacy/legal and safety advice before contacting affected users where lawful.
6. **Assess legal duties.** Counsel maps affected people and operator role to each jurisdiction's regulator/user notification triggers, recipients, content, and deadlines. GDPR's 72-hour supervisory-authority rule applies only where GDPR Article 33 conditions apply; it is not a worldwide universal deadline.
7. **Notify when required.** Use accurate, plain-language notices describing what happened, data involved, likely consequences, protective steps, contact, and updates required by the relevant law. Do not speculate or make unsupported promises.
8. **Recover.** Patch/configure, rotate credentials, restore only from a verified safe backup, and confirm owner-scoped access, health, CORS, authentication, and data integrity.
9. **Close and improve.** Preserve a timeline, decisions, legal analysis, provider evidence, notifications, and remediation. Assign corrective actions and dates; update threat model, tests, vendor register, and privacy notice.

## Credential exposure checklist

- [ ] Identify the credential without copying its value into the incident ticket.
- [ ] Revoke/rotate through the provider; update dependent services securely.
- [ ] Invalidate sessions/tokens where applicable.
- [ ] Inspect access logs for unauthorized use, preserving privacy and scope.
- [ ] Remove secrets from current files/history where possible; understand that deletion cannot retract copies already made.
- [ ] Record validation that the replacement works and the old credential no longer works.

## Tabletop test

Before launch and at least annually, simulate one leaked database credential and one unauthorized account disclosure. Record response times, missed contacts, backup/restore outcome, notification decision owner, and remediation.
