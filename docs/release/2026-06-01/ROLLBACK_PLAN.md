# Rollback Plan - v1.2.0-rc.1

Date: 2026-06-01

## Rollback Triggers

- Login or core product list is unavailable after release.
- Product add/edit cannot save valid products.
- Category dropdown is empty while active categories exist.
- Database migration causes runtime errors.
- Mobile scan flow breaks the normal manual product-code input path.

## Pre-release Backup

1. Backup production database before migration.
2. Backup current deployed backend package.
3. Backup current deployed frontend static files.
4. Record deployed commit hash and deployment time.

## Rollback Steps

1. Stop write traffic if the deployment platform supports maintenance mode.
2. Restore previous backend package.
3. Restore previous frontend static files.
4. Restore database from backup only if the migration created incompatible data or schema changes.
5. Restart service.
6. Run health, login, category, product-list, and product-create smoke checks.
7. Record rollback reason and impacted users in release notes.

## Data Compatibility Notes

This release adds product barcode and image fields. The migration is intended to be additive and idempotent. If rollback keeps the new columns in place, the previous application version should ignore them. A database restore is only required if production behavior proves incompatible.

