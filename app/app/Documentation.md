# Codebase Guide

This document is a developer handoff for the current repository. It explains what the app does, how the major pieces fit together, where the important logic lives, and which parts are easy to misunderstand on a first pass.

## What This Project Is

This repo is a two-service market screening app:

- `backend/` is a FastAPI API that builds an asset universe, fetches market data, applies indicator logic, runs post-filters, and returns normalized screening results.
- `frontend/` is a React + Vite client that requires Firebase auth, lets a user configure scans, runs them against the backend, and shows results, diagnostics, presets, and runtime controls.

The product supports:

- Stock screening from a locally cached Zoya universe
- Crypto screening from a locally cached crypto universe
- Single-timeframe scans
- Two-step gate/entry scans
- Local indicator evaluation
- Post-filters for channel respect and confluence
- SQLite-backed candle caching plus a background refresh worker

## Repo Layout

```text
app/
├── backend/
│   ├── api/
│   ├── core/
│   ├── data/
│   ├── models/
│   ├── scripts/
│   ├── services/
│   └── tests/
├── frontend/
│   ├── public/
│   └── src/
├── README.md
├── CLIENT_DELIVERABLES.md
└── CODEBASE_GUIDE.md
```

## Read This First

If you only have 20 minutes to get oriented, read these files in order:

1. `README.md`
2. `backend/main.py`
3. `backend/api/screening.py`
4. `backend/services/screener.py`
5. `backend/services/market_data.py`
6. `frontend/src/App.tsx`
7. `frontend/src/pages/Index.tsx`
8. `frontend/src/hooks/useScreener.ts`
9. `frontend/src/types/screener.ts`
10. `frontend/src/pages/SettingsPage.tsx`

## End-to-End Runtime Flow

### 1. The user builds a scan in the frontend

The main workspace is `frontend/src/pages/Index.tsx`.

- `useScreener()` holds all active filter state.
- `FilterSidebar` renders the filter UI.
- `RunControls` chooses between single-mode and gate/entry execution.
- `PresetBar` loads and saves filter snapshots through Firestore.

The frontend request shape is defined in `frontend/src/types/screener.ts` and assembled in `frontend/src/hooks/useScreener.ts`.

### 2. The frontend sends a request to the backend

The main requests are:

- `POST /screen/run`
- `POST /screen/run-gate`
- `POST /screen/run-entry`
- `POST /screen/details`
- `GET /screen/crypto-exchanges`

`useScreener.ts` makes these requests with manual `fetch` calls. It reads runtime overrides such as API base URL, timeout, and retries from `localStorage`.

### 3. FastAPI validates and routes the request

`backend/api/screening.py`:

- validates which route matches which `timeframe_mode`
- calls into `services/screener.py`
- exposes detail, exchange-options, worker, integration, and diagnostics endpoints
- protects only the `/ops/*` endpoints with `X-Admin-Token` if `ADMIN_API_TOKEN` is set

### 4. The screener service orchestrates the scan

`backend/services/screener.py` is the core orchestration file. It:

- builds the asset universe
- limits symbols
- decides how much candle history is required
- fetches market data
- attaches asset metadata
- applies indicator logic
- applies post-filters
- creates the final response shape

This file is the best place to start when debugging scan behavior.

### 5. The market-data layer serves candles

`backend/services/market_data.py` is the largest and most operationally important file.

It:

- decides which provider to use for each symbol
- reads/writes cached candle payloads
- fetches fresh candles from Massive or Binance
- handles grouped-history and snapshot fast paths
- reschedules failed refreshes with backoff
- attaches fundamentals when needed

### 6. Results come back to the UI

The results table lives in `frontend/src/components/screener/ResultsTable.tsx`.

It adds:

- search
- sorting
- category filters
- price filters
- watchlist state in `localStorage`
- compare state
- “download as Excel” via CSV-style browser download

When a user opens a result, the frontend calls `POST /screen/details` and renders the response in `ResultDetailPanel.tsx`.

## Backend Architecture

### Entry and app setup

`backend/main.py`

- creates the FastAPI app
- configures CORS
- starts/stops the background worker through the lifespan hook
- exposes `/`, `/healthz`, and `/readyz`
- reports degraded readiness if the worker is expected but not running, or if the active market-data provider needs an API key and none is configured

`backend/core/config.py`

- loads `backend/.env`
- defines all runtime settings through Pydantic settings
- normalizes booleans, integers, providers, and CORS values
- centralizes backend env vars

`backend/core/logging_config.py`

- sets the global logging format and level

### API layer

`backend/api/screening.py`

Main public endpoints:

- `POST /screen/run`: single-timeframe scans
- `POST /screen/run-gate`: gate pass of a gate/entry workflow
- `POST /screen/run-entry`: entry pass using a `gate_session_id`
- `POST /screen/details`: fetches a rich detail payload for one asset
- `GET /screen/crypto-exchanges`: returns exchange counts for the crypto filter UI

Admin/ops endpoints:

- `GET /screen/ops/worker`
- `GET /screen/ops/runtime-settings`
- `GET /screen/ops/integrations`
- `POST /screen/ops/integrations/config`
- `POST /screen/ops/diagnose`
- `POST /screen/ops/worker/start`
- `POST /screen/ops/worker/stop`
- `POST /screen/ops/worker/refresh`
- `POST /screen/ops/worker/config`

### Request and response models

`backend/models/filters.py`

- defines `ScreeningRequest`
- validates asset-type-specific behavior
- validates timeframe relationships
- validates confluence shape
- enforces manual-symbol limits

Important request concepts:

- `asset_type`: `stocks` or `crypto`
- `timeframe_mode`: `single` or `gate_entry`
- `indicators`: each has `name`, `timeframe`, and `config`
- `channel_respect`, `confluence`, and `price_range` are optional post-filters

`backend/models/results.py`

- defines the compact row returned in normal scan results
- defines the richer detail payload returned by `/screen/details`

Important response concepts:

- `stickers` are user-facing human-readable signal summaries
- `matched_indicators` should stay aligned by index with `stickers`
- `channels` and `confluence_channels` are diagnostic structures used by the detail view

### Orchestration

`backend/services/screener.py`

Responsibilities:

- filter indicators by scope: `single`, `primary`, `secondary`
- compute required candle depth from indicator configs
- apply price filtering before indicator evaluation
- attach channel data needed by post-filters
- apply indicator AND-logic
- build detail diagnostics
- manage gate-session lifecycle

Gate/entry flow:

1. `run_gate()` executes only `primary` indicators.
2. Passing asset metadata is stored in SQLite with a scope hash and optional client binding.
3. `run_entry()` reuses that stored metadata and executes only `secondary` indicators.
4. The session is deleted after a successful entry run.

### Universe building

`backend/services/asset_router.py`

Responsibilities:

- loads stock and crypto universes from JSON
- normalizes crypto symbols to `<BASE>-USD`
- filters crypto by exchange and category
- builds minimal metadata rows for screening
- resolves full metadata for detail requests

Stock universe:

- source file: `backend/data/zoya_universe.json`
- current supported source: `zoya` only

Crypto universe:

- source file: `backend/data/crypto_universe.json`
- exchange availability can come from `exchange` or `exchanges`
- if crypto provider is Binance, assets not available on Binance are excluded from screening

Manual symbol behavior:

- manual stock symbols return sparse metadata and `data_source: manual`
- manual crypto symbols are normalized to `-USD` and also use sparse metadata

### Indicators

`backend/services/indicators.py`

This file is the main indicator engine. It:

- compiles selected indicators into handlers
- applies them sequentially
- short-circuits on first failure
- builds stickers for passing indicators
- can also generate per-indicator detail diagnostics

The main live screening registry is `INDICATOR_REGISTRY`.

Current live scan handlers:

- `lrc`
- `regression`
- `rsi`
- `trend`
- `linreg_candles`
- `aroon`
- `wavetrend`
- `ema`
- `macd`
- `volume`
- `relative_volume`
- `current_volume`
- `float`
- `shares_outstanding`
- `volatility`

Supporting algorithm modules:

- `backend/services/rsi.py`
- `backend/services/wavetrend.py`
- `backend/services/aroon_oscillator.py`
- `backend/services/ema.py`
- `backend/services/macd.py`
- `backend/services/volume.py`
- `backend/services/regression_channels.py`
- `backend/services/trend_channels.py`
- `backend/services/linear_regression_candles.py`

Shared formatting and pattern helpers live in `backend/services/utils.py`.

### Post-filters

`backend/services/channel_respect.py`

- counts touches on a chosen channel line
- supports tolerance, clustering, and wick/body touch modes
- can also generate detail diagnostics

`backend/services/confluence.py`

- evaluates a two-source confluence rule
- supports bullish, bearish, breakout, and any-type logic
- requires exactly two selected sources after normalization
- also powers the detail diagnostics payload

### Market data

`backend/services/market_data.py`

This is the most complex backend module. Important behavior:

- Stocks always use the normalized “massive” provider.
- Crypto can use Massive or Binance.
- Provider naming still contains many legacy `polygon*` names even though the active vendor is Massive.
- `1h`, `4h`, and `1day` are the worker-managed cache timeframes.
- Other timeframes are still cached, but they are fetched on demand instead of being continuously refreshed by the worker.
- `next_refresh_at` is boundary-based, not just age-based.
- On provider failure, stale cached data can be reused with a temporary backoff.

Key ideas in this file:

- provider selection: `active_candle_provider()`, `active_crypto_candle_provider()`
- freshness and refresh scheduling: `is_refresh_due()`, `next_refresh_at_for_timeframe()`
- batch fetching: `fetch_batches()`
- main data entrypoint: `fetch_live_data()`

Fast paths:

- latest-only mode can use snapshots or Binance quotes
- grouped daily history has special bulk fetch paths for large symbol sets
- non-native timeframes are aggregated from lower-level candles where needed

### Persistence

`backend/services/market_data_store.py`

SQLite file:

- `backend/data/market_data_cache.db`

Tables used by the runtime:

- `market_data_cache`
- `market_data_interest`
- `gate_sessions` via `gate_session_store.py`

Additional tables also exist:

- `indicator_cache`
- `indicator_interest`

Those indicator-cache tables are currently provisioned by the schema but are not part of the main screening runtime path.

`backend/services/gate_session_store.py`

- stores gate results in the same SQLite DB
- enforces TTL
- optionally binds sessions to a client id and request scope hash

### Background worker

`backend/services/market_data_worker.py`

Responsibilities:

- seeds interest rows for the universe
- refreshes due symbols
- stores new snapshots
- reschedules unresolved refreshes with backoff
- prunes stale cache rows

Notes:

- worker seeding can be disabled independently from worker enablement
- symbol seeding respects `SCREENING_MAX_SYMBOLS`
- worker status powers `/readyz` and the settings dashboard

### Runtime integration toggles

`backend/services/integration_runtime.py`

This is an in-memory runtime control layer. It tracks:

- whether providers are enabled
- whether API keys exist
- call counts
- optional call limits

The frontend settings page uses this for diagnostics and operator controls.

## Frontend Architecture

### App shell and routing

`frontend/src/App.tsx`

- wraps the app with an error boundary, React Query provider, tooltip provider, toast systems, auth provider, and router
- lazy-loads pages
- protects the main app with `ProtectedRoute`

`frontend/src/contexts/AuthContext.tsx`

- wraps Firebase Auth
- exposes `user`, `loading`, `signIn`, `signUp`, `logout`, and `resetPassword`

`frontend/src/components/auth/ProtectedRoute.tsx`

- blocks access to the main app until Firebase auth resolves
- redirects anonymous users to `/auth`

Important security note:

- frontend routes are protected by Firebase auth
- backend screening endpoints are not authenticated
- only backend `/ops/*` endpoints can require the admin token

### Environment and Firebase

`frontend/src/config/env.ts`

- reads all `VITE_*` env vars
- defaults `VITE_API_BASE` to `http://localhost:8000/screen` in development
- throws immediately if required Firebase env vars are missing

`frontend/src/lib/firebase.ts`

- initializes Firebase
- exports `auth` and `db`

### Main workspace

`frontend/src/pages/Index.tsx`

- composes the primary scan screen
- wires `useScreener()` to `FilterSidebar`, `RunControls`, `PresetBar`, and `ResultsTable`
- loads/saves presets through `useUserSettings()`

### Core state and request execution

`frontend/src/hooks/useScreener.ts`

This is the main frontend state machine.

Responsibilities:

- owns all filter state
- normalizes timeframe pairs for gate/entry mode
- loads crypto exchange options
- builds backend request payloads
- calls the API with timeout/retry handling
- stores gate-session state
- fetches result details
- builds and loads filter snapshots

Important implementation details:

- API base, timeout, and retry values are read from `localStorage` at request time
- the hook filters indicator names against a frontend allowlist before sending them
- `runGateEntry()` performs gate then entry in sequence
- result details reuse the last request snapshot so the backend can rebuild the same filter context

### Filter schema and dynamic form generation

`frontend/src/types/screener.ts` is the frontend source of truth for:

- request/response TypeScript types
- indicator definitions
- default indicator configs
- confluence normalization helpers
- category mappings
- built-in timeframe presets

The indicator editor UI is mostly schema-driven:

- `IndicatorsFilter.tsx` reads `INDICATOR_DEFINITIONS`
- `getDefaultIndicatorConfig()` merges built-in defaults with optional runtime overrides from `localStorage`
- the trend-channel UI is the main special case because it edits an area-rule list

Related filter components:

- `AssetTypeFilter.tsx`
- `ComplianceFilter.tsx`
- `CryptoExchangeFilter.tsx`
- `EthicalFilter.tsx`
- `TimeframeFilter.tsx`
- `IndicatorsFilter.tsx`
- `ChannelRespectFilter.tsx`
- `ConfluenceFilter.tsx`
- `PriceRangeFilter.tsx`

### Results and drill-down

`frontend/src/components/screener/ResultsTable.tsx`

Responsibilities:

- renders scan results
- filters visible badges using `matched_indicators`
- supports watchlists in `localStorage`
- supports compare mode
- supports category and price filtering
- exports the visible result set
- lazy-loads detail on row click

`frontend/src/components/screener/ResultDetailPanel.tsx`

- renders metadata, matched stickers, indicator diagnostics, filter diagnostics, and raw backend JSON blocks
- makes backend behavior debuggable without opening dev tools

### Settings and operator controls

`frontend/src/pages/SettingsPage.tsx`

This page is both a user settings screen and an operations dashboard.

It can:

- save runtime overrides
- call `/healthz` and `/readyz`
- view backend runtime settings
- start, stop, refresh, and reconfigure the worker
- toggle provider state and runtime API keys
- run backend diagnostics
- edit indicator default overrides

Important detail:

- the settings page persists runtime control values to both Firestore and `localStorage`
- `useScreener.ts` reads from `localStorage`, not directly from Firestore state

### User settings persistence

`frontend/src/hooks/useUserSettings.ts`

- stores one Firestore document per user under `users/{uid}`
- persists presets and runtime control values
- returns `saveSettings`, `savePreset`, and `deletePreset`

### UI primitives

`frontend/src/components/ui/*`

- mostly shadcn/Radix-style primitives and wrappers
- important for presentation, but not where the app’s business logic lives

The custom layout/navigation pieces worth reading are:

- `frontend/src/components/layout/AppHeader.tsx`
- `frontend/src/components/ErrorBoundary.tsx`
- `frontend/src/components/screener/*`

## Data Files and Generated State

Tracked data files:

- `backend/data/zoya_universe.json`
- `backend/data/zoya_universe.json.bak`
- `backend/data/crypto_universe.json`

Generated runtime files:

- `backend/data/market_data_cache.db`

These data files are part of the product’s runtime behavior, not just sample fixtures.

## Scripts

`backend/scripts/update_zoya_universe.py`

- downloads the Zoya stock universe into `backend/data/zoya_universe.json`

`backend/scripts/update_crypto_universe.py`

- builds the crypto universe using Massive reference tickers and optional CryptoCompare exchange enrichment

`backend/scripts/filter_zoya_universe_by_massive.py`

- filters the Zoya universe down to symbols that Massive supports
- can write backups and removed-symbol output

Operational note:

- `backend/test.py` is an ad hoc external API experiment, not part of the real app/test flow

## Tests

Backend tests:

- `backend/tests/test_backend_services.py`
- `backend/tests/test_indicator_defaults.py`

Frontend tests:

- `frontend/src/test/indicator-defaults.test.ts`
- `frontend/src/test/confluence-config.test.ts`
- `frontend/src/components/screener/ResultsTable.test.tsx`
- `frontend/src/components/screener/filters/CryptoExchangeFilter.test.tsx`

Coverage is strongest around:

- request normalization
- asset-universe logic
- indicator defaults
- gate-session behavior
- results table category/filter UX

Coverage is weaker around:

- full frontend page flows
- Firebase integration behavior
- long-path market-data provider behavior against real APIs

## Environment Variables

### Backend

Most important settings from `backend/core/config.py`:

- `APP_ENV`, `DEBUG`, `LOG_LEVEL`
- `HOST`, `PORT`
- `CORS_ALLOW_ORIGINS`, `CORS_ALLOW_CREDENTIALS`
- `MARKET_DATA_WORKER_ENABLED`
- `MARKET_DATA_WORKER_SEED_UNIVERSE`
- `MARKET_DATA_WORKER_POLL_INTERVAL`
- `MARKET_DATA_WORKER_BATCH_SIZE`
- `MARKET_DATA_FETCH_BATCH_SIZE`
- `CANDLES_PROVIDER`
- `CRYPTO_CANDLES_PROVIDER`
- `SCREENING_MAX_SYMBOLS`
- `MANUAL_SYMBOLS_MAX`
- `GATE_SESSION_TTL_SECONDS`
- `MASSIVE_API_KEY` or `POLYGON_API_KEY`
- `ADMIN_API_TOKEN`

### Frontend

Required:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional:

- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_API_BASE`

## Change Recipes

### Add a new indicator

Frontend:

1. Add the name/type to `frontend/src/types/screener.ts`
2. Add field definitions to `INDICATOR_DEFINITIONS`
3. Add defaults to `INDICATOR_DEFAULT_CONFIGS`
4. Make sure `VALID_INDICATOR_NAMES` in `useScreener.ts` includes it
5. Add UI-specific help text if needed

Backend:

1. Add the name to `backend/models/filters.py`
2. Implement the handler in `backend/services/indicators.py` or a dedicated module
3. Register it in `INDICATOR_REGISTRY`
4. Update candle-depth calculations in `screener.required_candles_for_indicators()`
5. Add tests

### Add a new post-filter

1. Extend `ScreeningRequest` in both backend and frontend types
2. Add UI state to `useScreener.ts`
3. Add a sidebar control
4. Apply the filter inside `backend/services/screener.py`
5. Return detail diagnostics through `/screen/details`

### Add a new market-data provider

1. Extend provider normalization in `core/config.py` and `market_data.py`
2. Implement fetchers in `backend/services/market_data.py`
3. Update provider selection and expected-provider checks
4. Update `asset_router.py` if the provider constrains the universe
5. Expose runtime controls/diagnostics in `integration_runtime.py`
6. Update the settings dashboard if operators need to control it

## Important Gotchas

1. The codebase still uses many `polygon*` names for logic that now targets Massive. This is legacy naming, not a second active stock provider.
2. Only `1h`, `4h`, and `1day` are worker-managed cache timeframes. Everything else is more on-demand.
3. The frontend can show sample fallback results whenever the backend is unreachable by network, and that check is not gated by `appEnv.isDev`.
4. `indicator_cache` and `indicator_interest` exist in SQLite, and snapshot-evaluation code exists in `indicators.py`, but the main screening path does not currently use that subsystem.
5. Backend request types include `adx`, `sma`, and `stochrsi`, but the main frontend does not expose them and the live screening registry does not execute them in the normal candle-based path.
6. `complianceStandards` exists in frontend state, but requests are currently sent with `compliance_standards: null`, and the backend rejects non-empty values for the current Zoya-based universe.
7. The app uses Firebase auth only on the frontend. Screening endpoints themselves are not user-authenticated by the backend.
8. `matched_indicators` index order matters because the results table uses it to decide which stickers stay visible when filters are active.
9. `frontend/src/App.tsx` includes a React Query provider, but current data fetching is still done with direct `fetch` calls.
10. `frontend/tsconfig.app.json` has `strict: false`, so TypeScript is helpful but not enforcing a very hard safety boundary right now.

## Suggested Maintenance Priorities

If you are taking ownership of this project, the highest-leverage cleanup opportunities are:

1. Decide whether snapshot indicators are a real planned feature or dead code, then either wire them in fully or remove the unused path.
2. Align backend indicator support, frontend indicator support, and tests so the supported matrix is obvious.
3. Decide whether fallback sample results should be development-only.
4. Decide whether screening routes should remain unauthenticated or should also validate the Firebase user/server token.
5. Gradually rename legacy `polygon` identifiers to `massive` where that reduces confusion without creating risky churn.

## Summary

The backend is organized around one main orchestration pipeline and one main market-data module. The frontend is organized around one main hook, one central type/schema file, and a set of focused UI components. If you understand `services/screener.py`, `services/market_data.py`, `hooks/useScreener.ts`, and `types/screener.ts`, you understand most of the application’s real behavior.
