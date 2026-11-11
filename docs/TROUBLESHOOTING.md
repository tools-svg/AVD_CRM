# TROUBLESHOOTING & COMMON RESOLUTIONS

## 1. CORS Errors
- **Symptom**: `Access to fetch at ... has been blocked by CORS policy`.
- **Resolution**: Ensure `CORS_ORIGINS` in `backend/.env` contains your exact frontend origin (e.g. `http://localhost:5173`). In development, `CORSMiddleware` in `app/main.py` is configured with `allow_origins=["*"]`.

## 2. PostgreSQL Connection Failures
- **Symptom**: `OperationalError: could not connect to server`.
- **Resolution**:
  - Verify PostgreSQL service is active and network port (default 5432 or Supabase pooler 6543) is reachable.
  - Test connection string with `psql` or use the fallback SQLite database by specifying `DATABASE_URL="sqlite:///./avd_crm.db"`.

## 3. Upload Directory Permissions
- **Symptom**: `PermissionError: [Errno 13] Permission denied: './uploads'`.
- **Resolution**:
  - Check write permissions on `backend/uploads`. The backend automatically creates this directory on startup if permissions permit.

## 4. Rollback Window Expiration
- **Symptom**: UI change shows "Expired (Permanent)" and revert button is disabled.
- **Resolution**: Changes made more than 24 hours ago are locked permanently by design as specified in Section 4.1. Use Version Snapshots to restore earlier baselines.

