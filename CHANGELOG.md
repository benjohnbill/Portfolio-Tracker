# Changelog

All notable changes to the Portfolio Tracker will be documented in this file.

---

## [2024-12-14] Asset Replacement: CTA → DBMF

### Summary

Replaced the Managed Futures ETF from **CTA (Simplify Managed Futures)** to **DBMF (iMGP DBi Managed Futures)**.

### Changed

- **Ticker**: `CTA` → `DBMF`
- **Name**: "Simplify Managed Futures" → "iMGP DBi Managed Futures"
- All code references updated across 7 files
- Stress test now uses DBMF data directly (no proxy mapping needed)

### Reason

Portfolio structure change - switching managed futures ETF provider while maintaining the same strategic role.

### Affected Files

| File                | Changes                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `asset_map.json`    | Updated ticker and name                                                            |
| `js/data.js`        | Updated portfolio defaults (Line 10, 139)                                          |
| `js/app.js`         | Updated correlation tickers, rounding rules, account groups (Line 352, 1606, 1619) |
| `js/finance.js`     | Updated correlation matrix default, stress test weights (Line 1968, 2340)          |
| `js/ui.js`          | Updated chart color mapping (Line 208)                                             |
| `server.py`         | Updated asset mapping and stress test scenarios (Line 60, 547, 562)                |
| `rebalance_calc.py` | Updated asset mapping, shares, target weight (Line 14, 22, 32)                     |

### Deleted Files

- `stress_test_cache.json` - Deleted to regenerate with new DBMF key

### Portfolio Configuration

- **Target Weight**: 30% (unchanged)
- **Asset Type**: DEFENSE (unchanged)
- **Holdings**: 117 shares (as of 2024-12-14)
- **Currency**: USD (unchanged)

### LocalStorage Migration Required

After code update, run this script in browser console (F12 → Console):

```javascript
let portfolio = JSON.parse(localStorage.getItem("jg_portfolio"));
let ctaAsset = portfolio.find((a) => a.ticker === "CTA");
if (ctaAsset) {
  ctaAsset.ticker = "DBMF";
  ctaAsset.id = "dbmf";
  ctaAsset.name = "iMGP DBi Managed Futures";
  ctaAsset.shares = 117;
}
localStorage.setItem("jg_portfolio", JSON.stringify(portfolio));
location.reload();
```

---
