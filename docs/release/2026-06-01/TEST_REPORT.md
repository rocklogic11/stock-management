# Test Report - v1.2.0-rc.1

Date: 2026-06-01
UAT URL: https://points-biology-salem-filing.trycloudflare.com
Production URL: http://121.40.110.240
Temporary production HTTPS UAT URL: https://apps-burn-solve-edward.trycloudflare.com
Local URL: http://127.0.0.1:3000

## Summary

| Area | Result |
| --- | --- |
| Database migration | Passed |
| Backend syntax check | Passed |
| Frontend production build | Passed |
| API release smoke | Passed |
| HTTPS release smoke | Passed |
| PC UI smoke | Passed |
| Mobile UI smoke | Passed |
| Post-deploy observation | Passed |
| Production deploy | Passed after hotfix |

## Commands Executed

```powershell
npm run release:check
```

Result: passed.

```powershell
$env:SMOKE_BASE_URL='http://127.0.0.1:3000'; npm run smoke:release
```

Result: passed.

```powershell
$env:SMOKE_BASE_URL='https://points-biology-salem-filing.trycloudflare.com'; npm run smoke:release
```

Result: passed.

```powershell
$env:UI_BASE_URL='https://points-biology-salem-filing.trycloudflare.com'; npm run ui:smoke
```

Result: passed, 2 tests.

## API Smoke Coverage

- Health check.
- Owner login.
- Category list is non-empty.
- Product list loads.
- Product create with barcode and 4 images.
- Duplicate barcode is rejected.
- More than 4 images are rejected.
- Product edit updates barcode and images.
- Product detail returns edited barcode and image array.
- Dashboard summary returns `product_count`.
- Smoke test data cleanup runs after test.

## UI Smoke Coverage

| Viewport | Coverage |
| --- | --- |
| PC 1365x768 | Product page loads, no visible network error, add-product dialog opens, category options exist |
| Mobile 390x844 | Product page loads, no visible network error, add-product dialog opens, category options exist |

Screenshots:

- `docs/release/2026-06-01/artifacts/pc-products.png`
- `docs/release/2026-06-01/artifacts/pc-product-dialog.png`
- `docs/release/2026-06-01/artifacts/mobile-products.png`
- `docs/release/2026-06-01/artifacts/mobile-product-dialog.png`

## Post-deploy Observation

| Round | Health ms | Login ms | Categories ms | Category count | Products ms | Product total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4057 | 1245 | 621 | 6 | 568 | 16 |
| 2 | 452 | 976 | 688 | 6 | 434 | 16 |
| 3 | 424 | 1159 | 678 | 6 | 579 | 16 |

Observation: first HTTPS health request was slower, consistent with Cloudflare Tunnel warm-up. Subsequent rounds were stable.

## Release Package

Package: `releases/stock-management-v1.2.0-rc.1-20260601.zip`

Excluded from package:

- `node_modules`
- local `.env`
- uploaded files
- database/data directories
- runtime logs

## Remaining Production Deployment Blocker

Production deployment credentials were provided and the release was deployed to `121.40.110.240`.

## Production Deployment Record

Commit deployed first: `a3b50ec`
Hotfix deployed: `1790d48`
Deployment time: 2026-06-01 10:13-10:18 Asia/Shanghai
Backup directory: `/root/stock-management-backups/20260601-101333`

Actual server topology found during deployment:

- Frontend root: `/var/www/stock-management/web/dist`
- Backend runtime: `/opt/stock-management/server`
- PM2 process: `kuwanyubeiqi-server`
- Nginx `/uploads` alias changed to `/opt/stock-management/server/uploads`

Reason for Nginx upload alias change: PM2 runs the backend from `/opt/stock-management/server`, so product images are written under `/opt/stock-management/server/uploads`. Leaving Nginx pointed at `/var/www/.../uploads` would make uploaded images unavailable through public URLs.

## Production Hotfix

Issue: PM2 initially failed after deployment because `sequelize.sync({ alter: true })` attempted to synchronize the virtual `image_url` field to MySQL and generated invalid SQL:

```sql
ALTER TABLE `product` CHANGE `image_url` `image_url` VIRTUAL;
```

Fix: production startup now skips automatic schema alter. Database changes must run through explicit migration scripts.

## Production Verification

| Check | Result |
| --- | --- |
| PM2 restart | Passed, 2 cluster instances online |
| Backend local smoke on server | Passed |
| Public PC UI smoke | Passed |
| Public mobile viewport UI smoke | Passed |
| Product image upload through API | Passed |
| Uploaded image public `/uploads` access | Passed |
| Uploaded image deletion | Passed |
| Temporary production HTTPS tunnel health | Passed |
| Temporary production HTTPS tunnel PC/mobile UI smoke | Passed |

Production observation:

| Round | Health ms | Login ms | Categories ms | Category count | Products ms | Product total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3154 | 1172 | 1906 | 6 | 1886 | 13 |
| 2 | 784 | 1162 | 802 | 6 | 787 | 13 |
| 3 | 829 | 1174 | 799 | 6 | 793 | 13 |
| 4 | 1278 | 1218 | 810 | 6 | 769 | 13 |
| 5 | 795 | 1171 | 1852 | 6 | 795 | 13 |

## Remaining Blockers

- Permanent production access is still HTTP over IP. iOS real-time camera scanning requires HTTPS. A temporary Cloudflare Tunnel URL is available for this UAT run, but a real release should add a filed domain and HTTPS certificate.
- Local commits through `2bdd462` have not been pushed to GitHub because `github.com:443` was unreachable from this workstation after deployment. The hotfix is already applied on the production server.
- `npm audit` still reports vulnerabilities: backend 12, frontend 3.
- Frontend build warns about large chunks.
- Some scanner dependencies declare newer Node engine requirements than the server Node 18 runtime, but frontend build completed successfully because those packages are bundled at build time.
