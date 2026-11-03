# Project Brief — Private Stock & Crypto Screening System

**Status:** Draft
**Audience:** Traders and analysts who already have a defined strategy
**Repo:** `Private-Stock-Crypto-Screening-System`

---

## 1. What This Is

A screening platform for stocks and cryptocurrencies. You describe the technical conditions you care about, and the system evaluates every asset in its universe against those conditions and returns the ones that currently match.

It is a **discovery and filtering tool**. It finds candidates that meet criteria you define. It does not generate strategies, rank opportunities by expected return, or place trades.

Two services make up the product:

- **Backend** — a FastAPI service that builds the asset universe, fetches and caches market data, evaluates indicators, applies post-filters, and returns normalized results.
- **Frontend** — a React + Vite client with authenticated access, a visual filter builder, scan execution, result inspection, saved presets, and export.

---

## 2. Who This Is For

This tool is built for the trader who has **already decided what they are looking for**.

If you can finish the sentence *"I want to see every asset where ______"* with specific, mechanical conditions, this system turns that sentence into a repeatable scan across thousands of assets in seconds.

It is a poor fit for someone who does not yet have a strategy. The system will faithfully return matches for any filter you build, including filters with no historical edge. Defining and validating the strategy is the user's responsibility; executing the search is the tool's.

---

## 3. The Problem It Solves

A discretionary trader with a clear setup faces a mechanical bottleneck: the setup might appear on 30 assets out of 5,000, and the only way to find them manually is to open charts one at a time. That does not scale, it is inconsistent, and it gets worse across multiple timeframes.

This system removes that bottleneck in three ways:

1. **Coverage** — every asset in the universe is evaluated, not just the ones you remembered to check.
2. **Consistency** — the same rules are applied identically every time, with no fatigue and no drift in judgment at asset number 400.
3. **Speed** — a warm local cache of candle data means scans run against stored data rather than waiting on a data provider for every symbol.

---

## 4. What You Can Express in a Filter

### Universes

| Asset class | Source | Notes |
|---|---|---|
| Stocks | Local Zoya universe | Includes Sharia compliance status, purification ratio, report date |
| Crypto | Local crypto universe | Exchange listings and category metadata |

Crypto exchange filtering is strict: selecting exchanges returns only assets actually listed on them.

### Timeframes

Seven canonical timeframes are supported — `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1day` — plus custom units (minutes, hours, days, weeks, months) in the UI with matching backend parsing. The `4h` series is derived by aggregating `1h` candles.

### Indicators

Ten indicators are available, each with a configurable parameter surface (length, window, confirmation behavior, tolerance, and rule-specific options):

- **Momentum** — RSI, Aroon, WaveTrend, MACD
- **Trend** — EMA, Linear Regression Candles
- **Channels** — Linear Regression Channel (LRC), Regression Channel, Trend Channels
- **Volume** — Volume

Indicators run in sequence and short-circuit on the first failure, so an asset must satisfy every selected rule to survive. If one rule fails, the asset is excluded.

### Post-Filters

Two higher-order filters run on top of the indicator layer:

- **Channel Respect** — counts how many times price has touched a selected channel line within a tolerance, with clustering to avoid double-counting a single event. Useful when you only trust a level that price has honored repeatedly.
- **Confluence** — evaluates scenario-based bullish, bearish, and breakout conditions across exactly two selected lines or zones within a 1–4 candle timing window, with an optional liquidity sweep filter. Useful when you require several independent signals to agree before acting.

### Two-Stage Gate/Entry Screening

The system supports a multi-timeframe funnel that mirrors how many discretionary strategies actually work:

1. **Gate** — screen the full universe on a slower timeframe (e.g. daily) to isolate assets in the right structural condition. Returns a `gate_session_id`.
2. **Entry** — screen only the gate survivors on a faster timeframe (e.g. 15m) to time a specific entry.

Gate sessions are persisted with a TTL and are single-use, so an entry run is always tied to a specific, reproducible gate result.

### Ethical and Compliance Filtering

A differentiating capability. The stock universe carries Zoya Sharia compliance data (`compliance_status`, `purification_ratio`, `report_date`), and crypto results can exclude categories: **memecoins, gambling, interest-bearing (riba), adult, and scam**.

For traders operating under Islamic finance constraints, this filtering is built into the screening pipeline rather than bolted on afterward.

---

## 5. What You Get Back

Each result row carries:

`symbol` · `name` · `price` · `asset_type` · `exchange` · `category` · `timeframe` · `data_source` · `cmc_id` · `compliance_status` · `report_date` · `purification_ratio` · `candles_count` · `last_candle_time` · `stickers`

**Stickers** are human-readable summaries of *why* each asset matched (e.g. `EMA (9) | above`), so a result can be audited rather than taken on trust.

Supporting features:

- **Result detail panel** for inspecting an individual match
- **Excel export** of the result set (`screener-results.xls`)
- **Saved presets** persisted per user in Firestore, so a strategy defined once can be re-run in one click
- **Connection and runtime status** surfaced in the UI, including worker health

---

## 6. Scope Boundaries — What This Does Not Do

Stated explicitly, because these boundaries determine whether the tool fits a given workflow.

| Not included | Implication |
|---|---|
| **Backtesting** | The system cannot tell you whether a filter has ever been profitable. Strategy validation must happen elsewhere. |
| **Alerting / notifications** | No email, webhook, push, or messaging integration. Results are pull-based. |
| **Scheduled scans** | The background worker refreshes *market data* continuously, but scans are run on demand by the user. |
| **Order execution** | No broker or exchange trading integration. The system never places, modifies, or cancels an order. |
| **Portfolio tracking** | No positions, P&L, or risk management. |
| **Ranking or scoring** | Results are matches, not recommendations. Nothing is sorted by expected return. |

**The most consequential gap is backtesting.** Because a screener will always return matches from a large universe — that is true even of random data — the fact that a filter produces results carries no information about whether it works. Users must independently validate any strategy before relying on it.

---

## 7. Architecture

**Backend (Python / FastAPI, ~13.3k LOC)**

```
api/         → request validation, screening + health endpoints
services/    → screener orchestration, indicators, market data, worker
models/      → request (filters) and response (results) schemas
data/        → local JSON universes + SQLite candle cache
scripts/     → universe refresh and maintenance utilities
```

The screening pipeline: build universe → apply symbol cap → fetch market data (cache-first) → attach universe metadata → apply indicators → apply post-filters → build normalized response.

Market data is cache-first. Snapshots are reused until refresh is due; on a provider failure the system falls back to the stale snapshot with a backoff rather than failing the scan. A background worker seeds interest rows for the universe and refreshes symbols in a fixed timeframe priority order (`1day` → `4h` → `1h` → `30m` → `15m` → `5m` → `1m`).

**Frontend (React + Vite + TypeScript, ~10.4k LOC)**

```
pages/       → Index (workspace), SettingsPage, AuthPage
hooks/       → useScreener (state + API), useUserSettings (Firestore)
components/  → filter sidebar, indicator config, results table, detail panel
types/       → indicator schema and defaults
```

Authentication is Firebase Auth; user settings and presets persist to Firestore.

**Endpoints:** `POST /screen/run` · `POST /screen/run-gate` · `POST /screen/run-entry` · `GET /` · `GET /healthz` · `GET /readyz`

---

## 8. Current Status

Both services build and run. The backend starts cleanly and serves all health endpoints; the frontend typechecks, passes its test suite, and produces a working production build.

Known issues at time of writing:

- **2 backend tests failing (160/162 pass).** Both assert a trend-channel candle budget of 49 after the production constant was deliberately changed to produce 73. Stale assertions, not a functional regression.
- **Frontend Node version pin is inconsistent.** `package.json` requires Node `20.x`, `.nvmrc` specifies `22`, and `engine-strict=true` causes `npm ci` to hard-fail on any other version.
- **Lint fails on 2 errors** (`no-explicit-any` in a test fixture), which blocks the `npm run check` gate used before deployment.
- **Main JS bundle is 780 KB** (211 KB gzipped), above the recommended threshold.

---

## 9. Proposed Roadmap

Ordered by impact on the target user.

1. **Backtesting engine** — replay a saved filter across historical candles and report match frequency and forward returns. This is the single highest-value addition; it converts the tool from "find matches" to "find matches worth acting on."
2. **Alerting** — notify when a saved preset produces new matches, removing the need to manually re-run scans.
3. **Scheduled scans** — run presets automatically on a cadence tied to the timeframe.
4. **Result history** — persist past scan results to allow comparison over time and support outcome tracking.
5. **Housekeeping** — fix the failing assertions, reconcile the Node pin, clear the lint errors, and code-split the main bundle.

---

## 10. Summary

For a trader with a defined, mechanical strategy, this system converts a manual and unscalable search into a repeatable one, with genuine differentiation in its Sharia-compliance and ethical filtering.

Its value is bounded by one condition: **the quality of the output depends entirely on the quality of the strategy fed into it.** The platform is a precision instrument for executing a search, and adding backtesting is what would let users know whether the search is worth running at all.
