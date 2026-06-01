# UAT Checklist - v1.2.0-rc.1

Date: 2026-06-01

## PC Browser

| Case | Steps | Expected Result |
| --- | --- | --- |
| Login | Open system, login as owner | Login succeeds and enters dashboard |
| Product list | Open product archive | Product table loads, category filter loads |
| Add product | Click add product, fill name/category/price/barcode | Product saves successfully |
| Edit product | Edit saved product barcode and images | Product updates successfully |
| Duplicate barcode | Add or edit another product with same barcode | System blocks save |
| Dashboard | Open home/dashboard | Key metrics and charts render without API errors |

## iOS Mobile Browser

| Case | Steps | Expected Result |
| --- | --- | --- |
| HTTPS access | Open public HTTPS URL in Safari | Page loads and login works |
| Mobile layout | Open product archive | Controls fit screen, no horizontal overflow |
| Real-time scan | Add product, tap scan, allow camera | Camera preview opens and scanner fills barcode field |
| Photo recognition fallback | Take/select barcode image | Recognizer returns barcode or fails with visible retry/manual-input path |
| Product photos | Add 1-4 photos | Thumbnails show and submit succeeds |
| Over-limit photos | Try adding more than 4 photos | System prevents or rejects over-limit upload |

## Regression

| Module | Minimum Check |
| --- | --- |
| Scan inbound | Existing scan inbound page opens and can search product code |
| Inventory count | Inventory page opens, category list loads |
| Stock query | Stock query page opens, category list loads |
| Role switch | Owner can see cost fields, clerk restrictions remain |

## UAT Exit Criteria

- No P0/P1 defect remains.
- Product add/edit works on both PC and iOS mobile.
- Category dropdown is not empty when active categories exist.
- iOS real-time camera scanning works over HTTPS.
- Release smoke script passes against the same URL used for UAT.

