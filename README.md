# Property Value Enhancement Backend

Backend API for property value enhancement workflows (auth, properties, recommendations, valuations, ROI, renovation tracking, reports, and monitoring).

## Prerequisites

- Node.js 20+
- npm
- MySQL (for runtime data)
- Redis (optional but recommended for caching)

## Setup

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Create `/home/runner/work/FSD-FINAL-PROJECT-BACKEND/FSD-FINAL-PROJECT-BACKEND/.env` with required values:
   - `JWT_SECRET`
   - `MYSQL_URI` **or** `MYSQL_DB` + `MYSQL_USER` (+ optional password/host/port)
   - Optional:
     - `FRONTEND_URL`
     - `CORS_ALLOWED_ORIGINS` (comma-separated)
     - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
     - `ENABLE_DEMO_ACCOUNTS=true|false`
     - `MAX_UPLOAD_FILE_SIZE_MB`

## Run

- Development:
  ```bash
  npm run dev
  ```
- Production-style start:
  ```bash
  npm start
  ```

Server default port: `5000` (override with `PORT`).

## Scripts

- `npm run lint` — syntax-check all JS files
- `npm run build` — backend build placeholder
- `npm test -- --runInBand` — test suite

## API docs

- OpenAPI JSON: `/api/openapi.json`
- Swagger UI: `/api-docs`
- Health check: `/api/health`

## CI

GitHub Actions workflow runs:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npm test -- --runInBand`

## Security notes

- Demo account seeding is disabled by default outside development.
- CORS in production only allows explicitly configured origins.
- Property image uploads only allow `image/jpeg`, `image/png`, and `image/webp`, with bounded file size.
