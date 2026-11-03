# App

This repository contains two services:

- `backend/`: FastAPI-based screening API
- `frontend/`: Vite + React client

## Project Structure

```text
app/
├── backend/
└── frontend/
```

## Quick Start

### 1) Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Backend default URL: `http://localhost:8000`

For backend-specific details, see [backend/README.md](./backend/README.md).

### 2) Frontend

```bash
cd frontend
npm ci
npm run dev
```

Frontend default URL: `http://localhost:8080`

For frontend environment variables and production build details, see [frontend/README.md](./frontend/README.md).

## Production Notes

- Frontend requires `VITE_API_BASE` and Firebase `VITE_FIREBASE_*` variables.
- Run `npm run check` and `npm run build` inside `frontend/` before deploying.
