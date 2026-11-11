# AVD Group CRM — Supabase PostgreSQL Setup

This application uses **SQLAlchemy ORM** with a custom FastAPI JWT login. It does **not** use Supabase Auth. The backend connects to Supabase as a PostgreSQL database.

Do not paste `schemas.py` into the Supabase SQL Editor. That file is Python (Pydantic request/response models), not SQL.

Use `database/supabase_schema.sql` instead. Table names match the SQLAlchemy models in `backend/app/models/all_models.py` (for example `user_company_assignments`, not `user_companies`).

---

## 1. Create a Supabase project

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**, choose an organization, set a strong database password, and wait until the project is ready.
3. Keep the database password. It is required for `DATABASE_URL` and is not shown again in full.

---

## 2. Find the Supabase URL and keys

In the project dashboard:

1. Open **Project Settings** (gear icon).
2. Open **API**.
   - **Project URL** → `SUPABASE_URL`
   - **anon / public** key → `SUPABASE_KEY` (never used by this React app for data access)
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (backend only, never in frontend)
3. Open **Database**.
   - Copy the **URI** connection string.
   - Direct (recommended for this app): `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - Session pooler (IPv4 / some networks): port `6543` with the pooler hostname shown in the dashboard.

Replace `[YOUR-PASSWORD]` with the database password. URL-encode special characters (`@` → `%40`, `#` → `%23`).

---

## 3. Configure backend environment variables

Copy `backend/.env.example` to `backend/.env` (already present in this repo).

Set at least:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
ALLOW_SQLITE_FALLBACK=false
SECRET_KEY="a-long-random-jwt-secret"
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_KEY="your-anon-key"
```

The frontend talks only to FastAPI (`/api`). Do not put the service role key or database password in React code.

The backend always loads `backend/.env`, even if you start the process from the repo root.

---

## 4. Execute `supabase_schema.sql`

**Option A — Supabase SQL Editor**

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the full contents of `database/supabase_schema.sql`.
3. Click **Run**.
4. Confirm the status row (`roles_count` should be 6).

**Option B — from this repo (after `DATABASE_URL` is set)**

```powershell
cd "c:\Users\BALAMURUGAN\Downloads\Ndurance_work\AVD_Group's_CRM\version_3"
python database/apply_schema.py
```

The script is idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). It does not drop tables.

---

## 5. Verify that all tables were created

In **Table Editor** you should see 20 tables:

`roles`, `companies`, `users`, `user_company_assignments`, `projects`, `project_employee_assignments`, `modules`, `module_employee_assignments`, `comments`, `updates`, `attachments`, `sticky_notes`, `sticky_note_mentions`, `notifications`, `project_shares`, `gantt_dependencies`, `ui_configurations`, `ui_change_history`, `ui_version_snapshots`, `activity_logs`

Or call:

```text
GET http://127.0.0.1:8000/api/health
```

`database.missing_tables` must be `[]` and `database.dialect` must be `postgresql`.

If `sqlite_fallback` is `true` or `dialect` is `sqlite`, the backend is not using Supabase.

---

## 6. Database permissions and RLS

- Custom FastAPI JWT is the only login system. Preserve it.
- RLS is enabled on application tables so the **anon** PostgREST role cannot read employee or project rows.
- The backend `postgres` role is a superuser and bypasses RLS.
- `service_role` has a full-access policy for server-side Supabase clients.
- Public sharing still goes through FastAPI (`/api/public/project/{token}`), not through unrestricted table access.

Do not turn on extra public policies unless you also add matching FastAPI checks.

---

## 7. Create the initial administrator account

Start the backend once with a working `DATABASE_URL`. `seed_database()` creates accounts only when the `users` table is empty.

| Username | Password | Role |
|----------|----------|------|
| `developer` | `dev123` | Developer |
| `director` | `dir123` | Director |
| `pm` | `pm123` | Project Manager |
| `manager` | `mgr123` | Manager |
| `employee` | `emp123` | Employee |
| `claire` | `emp123` | Employee |

Change these passwords after first login (`PUT /api/auth/me`).

To create an extra admin later, log in as `developer` and use `POST /api/users`.

---

## 8. Verify database connectivity

```powershell
cd backend
python -c "from app.database.session import engine, sanitized_display; from sqlalchemy import text; print(sanitized_display); print(engine.connect().execute(text('SELECT 1')).scalar())"
```

Then start FastAPI and open `/api/health` and `/api/docs`.

---

## 9. Troubleshoot common errors

### HTTP 500 `relation "roles" does not exist`
The schema was never applied to the database the backend is using. Run `supabase_schema.sql` against that project, or confirm `/api/health` is not still on SQLite.

### Backend works locally but Supabase Table Editor is empty
`backend/.env` still has `DATABASE_URL="sqlite:///./avd_crm.db"`. Point it at the Supabase URI. SQLite fallback is disabled unless `ALLOW_SQLITE_FALLBACK=true`.

### `password authentication failed`
The password in `DATABASE_URL` is wrong. Reset it under **Settings → Database**.

### `could not translate host name` / IPv6 errors
Use the **connection pooler** URI from the dashboard (often port `6543`) instead of `db.[ref].supabase.co`.

### `syntax error` after pasting Python
You pasted `schemas.py`. Use `database/supabase_schema.sql`.

### Login 401 after applying SQL only
User rows are created by the FastAPI seed, not by the SQL file. Start the backend once.

### Tenant RLS blocking backend queries
This app must connect as `postgres` (or another BYPASSRLS role), not as `anon`.

---

## Start the application

Backend:

```powershell
cd backend
python -m pip install -r requirements.txt
python server.py
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and log in with `developer` / `dev123`.
