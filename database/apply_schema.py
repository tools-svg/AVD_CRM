"""
Apply database/supabase_schema.sql using DATABASE_URL from backend/.env.

Usage (from the version_3 folder):
    python database/apply_schema.py
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

from app.core.config import settings  # noqa: E402
from app.database.session import (  # noqa: E402
    engine,
    get_existing_tables,
    get_missing_tables,
    normalize_database_url,
    sanitize_database_url,
)


def apply_schema() -> None:
    schema_path = ROOT / "database" / "supabase_schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    url = normalize_database_url(settings.DATABASE_URL)
    print(f"Applying schema to: {sanitize_database_url(url)}")

    if url.startswith("sqlite"):
        print("DATABASE_URL is SQLite. SQLAlchemy create_all will be used instead of PostgreSQL DDL.")
        from app.database.session import Base
        import app.models.all_models  # noqa: F401
        Base.metadata.create_all(bind=engine)
    else:
        raw = engine.raw_connection()
        try:
            raw.autocommit = True
            cursor = raw.cursor()
            cursor.execute(sql)
            cursor.close()
        finally:
            raw.close()

    existing = get_existing_tables()
    missing = get_missing_tables()
    print(f"Tables present ({len(existing)}): {sorted(existing)}")
    if missing:
        print(f"MISSING required tables: {missing}")
        sys.exit(1)
    print("Schema application complete.")


if __name__ == "__main__":
    apply_schema()
