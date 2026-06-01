# Release Plan - v1.2.0-rc.1

Date: 2026-06-01
Scope: mobile barcode/QR scanning, product photo upload, mobile responsive product flows, product category stability, release checks.

## Release Goals

1. Product add/edit supports barcode or QR code input from mobile scanning.
2. Product add/edit supports up to 4 product photos.
3. PC and mobile product archive pages remain usable with the same backend API.
4. Product category dropdown must load reliably before product save.
5. Release must pass build, migration, syntax, API smoke, and post-deploy observation checks.

## In Scope

- Frontend production build from `web`.
- Backend migration `migrate:barcode-images`.
- Product API validation for `barcode` and `images`.
- Category API cache/read reliability.
- Release smoke automation.
- Temporary public HTTPS validation through Cloudflare Tunnel when no production host credentials are available.

## Out of Scope

- Changing production DNS.
- Replacing the current deployment architecture.
- Full data migration from another system.
- App Store or native app packaging.

## Release Gates

| Gate | Required Result |
| --- | --- |
| Backend syntax check | Pass |
| Database migration | Pass and idempotent |
| Frontend build | Pass |
| Category API | Authenticated request returns non-empty array |
| Product API | Create, duplicate-barcode reject, image-count reject, edit, detail, cleanup pass |
| Dashboard API | Authenticated request returns dashboard summary |
| Mobile HTTPS access | Public HTTPS URL available for iOS camera testing |
| Observation | Health and login checks pass after deployment |

## Deployment Decision

Current workstation can publish a testable HTTPS URL through Cloudflare Tunnel. A real production deployment requires one of the following verified inputs:

- SSH host/user/key or CI/CD runner credentials.
- Production deployment platform access.
- Confirmed target domain and DNS control.
- Production database backup and migration window.

Do not use hardcoded examples in historical deployment documents as live credentials.

