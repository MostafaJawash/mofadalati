# مفاضلتي — shared admissions & preferences

A centralized Next.js app for one student (default score **83%**, scientific branch, 2026‑2027):

- **`/`** (public, no login): shows only the admission options available for the configured score, with General (عام) and Parallel (موازي) checked independently, plus the one shared preference list (no limit on its length) and a PDF download.
- **`/admin`** (password protected): manage the shared preference list (add, drag to reorder, remove, clear, lock and unlock), edit the admission data, change site settings (score, academic year, title), and view the change history.

PostgreSQL is the single source of truth. Nothing important lives in `localStorage` or React state. Every change goes through a server action, is written to the database inside a transaction, and appears on every open browser within about 3 seconds.

## Architecture

```
Browser ──> Next.js (server components + server actions + route handlers) ──> PostgreSQL
   ▲                                                                            │
   └──── polls /api/sync every 3s; on revision change → router.refresh() ◄──────┘
```

| Table | Purpose |
|---|---|
| `admissions` | 803 rows extracted from إعلان رقم 2 (pages 1–21, including the defence and security universities). Each track has `*_available`, `*_minimum` (NULL = no total‑score minimum, e.g. "جميع المتقدمين") and `*_conditions`. |
| `preferences` | The shared list. `position` is unique (1..n, always contiguous, no upper limit) and `(admission_id, track)` is unique. |
| `settings` | `student_score`, `academic_year`, `site_title`, `preferences_locked`. |
| `audit_log` | Every mutation, with the editor's name and a timestamp. |
| `sync_state` | A revision counter bumped by triggers on any data change. Clients poll it, and its row lock serializes concurrent preference edits. |

Filtering happens in SQL (`getAvailableAdmissions`), so the homepage only receives options open to the current score. Change the score in **/admin → إعدادات الموقع** and the public page updates with no code change.

## Setup

1. Create a PostgreSQL database. Supabase works well: *Project Settings → Database → Connection string*. On serverless hosts use the pooler URL and append `?sslmode=require`.
2. Copy the env file and fill it in:
   ```bash
   cp .env.example .env.local
   # DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
   ```
3. Create the schema and import the admission data:
   ```bash
   npm install
   npm run db:setup                       # idempotent
   npm run db:setup -- --reset-admissions # re-import db/admissions.json (clears preferences)
   ```
4. Run:
   ```bash
   npm run dev        # http://localhost:3000
   npm run build && npm start
   ```

For a local database: `docker run -d --name mofadalati-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mofadalati -p 54329:5432 postgres:16-alpine` (matches `.env.example`).

## Admin access

Editors sign in at `/admin` with `ADMIN_PASSWORD` and a display name (recorded in the history). The session is an HMAC‑signed, httpOnly cookie. Every server action re‑checks the session and the lock state on the server, so public visitors cannot change anything even if they call an action directly.

## PDF

`GET /api/preferences/pdf` renders the current database list (every preference, across as many pages as needed) with `@react-pdf/renderer` and IBM Plex Sans Arabic (`assets/fonts`, OFL).

## Re-extracting the data

`scripts/build.py` and `scripts/transform.py` (Python, `pip install pymupdf`) rebuild `db/admissions.json` from the ministry PDF. Run them from a folder containing the PDF saved as `src.pdf`.
