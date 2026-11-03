# Frontend

React + Vite app for the market screener UI.

## Requirements

- Node.js 18+
- npm 9+
- Running backend API (default: `http://localhost:8000`)

## Environment Variables

Create `frontend/.env` (there is no `.env.example` in this repo).

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
  - If omitted in development, defaults to `http://localhost:8000/screen`
  - In production, it is required

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open the URL shown by Vite (usually `http://localhost:5173`).

## Scripts

- `npm run dev`: start Vite dev server
- `npm run typecheck`: run TypeScript check
- `npm run lint`: run ESLint
- `npm run test`: run Vitest once
- `npm run test:watch`: run Vitest in watch mode
- `npm run check`: typecheck + lint + tests
- `npm run build`: typecheck + production build
- `npm run build:dev`: build using development mode
- `npm run preview`: serve built app locally

## API Integration Notes

- Frontend calls backend endpoints under `${VITE_API_BASE}`:
  - `POST /run`
  - `POST /run-gate`
  - `POST /run-entry`
- Gate/Entry flow stores and reuses `gate_session_id`.
- A connection status indicator pings backend root endpoint.
- In dev only, if backend is unavailable, sample fallback results are shown.

## Build Output

- Production files are generated in `frontend/dist/`.
