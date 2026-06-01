# Test Report - v1.2.0-rc.1

Date: 2026-06-01
Test URL: https://points-biology-salem-filing.trycloudflare.com
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

This workstation does not currently have verified production host credentials, CI/CD credentials, DNS control, or a confirmed deployment target. The current test URL is a Cloudflare Tunnel URL backed by this local machine, suitable for UAT and iOS camera testing, but not a permanent production URL.

