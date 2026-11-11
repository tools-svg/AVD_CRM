"""
SQLite to Supabase PostgreSQL Migration Script
Migrates all data from avd_crm.db to Supabase PostgreSQL.

Usage:
    cd version_3
    set PYTHONPATH=backend
    python backend/migrate_sqlite_to_postgres.py
"""

import os
import sys
import sqlite3
import logging
from pathlib import Path

# Setup path
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text, inspect as sa_inspect, Boolean, Integer, Float
from sqlalchemy.types import NullType
from app.database.session import engine, Base, get_existing_tables
from app.core.config import settings
import app.models.all_models  # Register all models

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s"
)
logger = logging.getLogger("migration")

# SQLite source database path
SQLITE_DB_PATH = PROJECT_DIR / "avd_crm.db"

# Tables in dependency order (parents before children)
MIGRATION_ORDER = [
    "roles",
    "companies",
    "users",
    "user_company_assignments",
    "projects",
    "project_employee_assignments",
    "modules",
    "module_employee_assignments",
    "comments",
    "updates",
    "attachments",
    "sticky_notes",
    "sticky_note_mentions",
    "notifications",
    "project_shares",
    "gantt_dependencies",
    "ui_configurations",
    "ui_change_history",
    "ui_version_snapshots",
    "activity_logs",
]


def get_sqlite_connection():
    """Connect to the SQLite source database."""
    if not SQLITE_DB_PATH.exists():
        logger.error("SQLite database not found at: %s", SQLITE_DB_PATH)
        sys.exit(1)
    conn = sqlite3.connect(str(SQLITE_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def get_sqlite_table_columns(sqlite_conn, table_name):
    """Get column names for a SQLite table."""
    cursor = sqlite_conn.execute(f"PRAGMA table_info([{table_name}])")
    return [row["name"] for row in cursor.fetchall()]


def get_postgres_column_info(pg_engine, table_name):
    """Get column names and types for a PostgreSQL table."""
    inspector = sa_inspect(pg_engine)
    columns = inspector.get_columns(table_name)
    return {col["name"]: col["type"] for col in columns}


def get_row_count(sqlite_conn, table_name):
    """Count rows in a SQLite table."""
    cursor = sqlite_conn.execute(f"SELECT COUNT(*) FROM [{table_name}]")
    return cursor.fetchone()[0]


def get_pg_row_count(pg_engine, table_name):
    """Count rows in a PostgreSQL table."""
    with pg_engine.connect() as conn:
        result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        return result.scalar()


def is_boolean_type(col_type):
    """Check if a SQLAlchemy column type is boolean."""
    return isinstance(col_type, Boolean)


def convert_value(value, col_type):
    """Convert a SQLite value to PostgreSQL-compatible type."""
    if value is None:
        return None

    # SQLite stores booleans as 0/1 integers
    if is_boolean_type(col_type):
        if isinstance(value, int):
            return bool(value)
        if isinstance(value, str):
            return value.lower() in ("1", "true", "yes")
        return bool(value)

    return value


def clear_table(pg_engine, table_name):
    """Delete all rows from a PostgreSQL table (for clean re-migration)."""
    with pg_engine.begin() as conn:
        conn.execute(text(f"DELETE FROM {table_name}"))


def migrate_table(sqlite_conn, pg_engine, table_name):
    """Migrate a single table from SQLite to PostgreSQL."""
    sqlite_count = get_row_count(sqlite_conn, table_name)
    if sqlite_count == 0:
        logger.info("  %s: 0 rows (skipping)", table_name)
        return 0

    # Get columns that exist in both SQLite and PostgreSQL
    sqlite_cols = get_sqlite_table_columns(sqlite_conn, table_name)
    try:
        pg_col_info = get_postgres_column_info(pg_engine, table_name)
    except Exception as e:
        logger.error("  %s: Table not found in PostgreSQL: %s", table_name, e)
        return 0

    pg_cols = list(pg_col_info.keys())

    # Only migrate columns present in both
    common_cols = [c for c in sqlite_cols if c in pg_cols]
    if not common_cols:
        logger.warning("  %s: No common columns found!", table_name)
        return 0

    # Read all rows from SQLite
    cols_str = ", ".join([f"[{c}]" for c in common_cols])
    cursor = sqlite_conn.execute(f"SELECT {cols_str} FROM [{table_name}]")
    rows = cursor.fetchall()

    if not rows:
        logger.info("  %s: 0 rows (skipping)", table_name)
        return 0

    # Build INSERT with ON CONFLICT DO NOTHING (idempotent)
    pg_cols_str = ", ".join(common_cols)
    placeholders = ", ".join([f":{c}" for c in common_cols])
    insert_sql = text(
        f"INSERT INTO {table_name} ({pg_cols_str}) VALUES ({placeholders}) "
        f"ON CONFLICT DO NOTHING"
    )

    inserted = 0
    errors = 0
    for row in rows:
        row_dict = {}
        for c in common_cols:
            val = row[c]
            col_type = pg_col_info.get(c)
            row_dict[c] = convert_value(val, col_type)

        # Each row in its own transaction to avoid cascade failures
        try:
            with pg_engine.begin() as conn:
                result = conn.execute(insert_sql, row_dict)
                inserted += result.rowcount
        except Exception as e:
            errors += 1
            if errors <= 3:  # Only log first 3 errors per table
                logger.warning("  %s: Error inserting row (id=%s): %s",
                             table_name, row_dict.get("id", "?"), str(e)[:200])

    if errors:
        logger.info("  %s: %d/%d rows migrated (%d errors, source had %d)",
                    table_name, inserted, sqlite_count, errors, sqlite_count)
    else:
        logger.info("  %s: %d/%d rows migrated (source had %d)",
                    table_name, inserted, sqlite_count, sqlite_count)
    return inserted


def reset_sequences(pg_engine):
    """Reset PostgreSQL sequences to match max IDs after data migration."""
    logger.info("\nResetting PostgreSQL sequences...")
    with pg_engine.begin() as conn:
        for table_name in MIGRATION_ORDER:
            try:
                # Check if table has an 'id' column
                inspector = sa_inspect(pg_engine)
                columns = [col["name"] for col in inspector.get_columns(table_name)]
                if "id" not in columns:
                    continue

                # Get max ID
                result = conn.execute(text(f"SELECT MAX(id) FROM {table_name}"))
                max_id = result.scalar()
                if max_id is None:
                    continue

                # Find the sequence name
                seq_result = conn.execute(text(
                    f"SELECT pg_get_serial_sequence('{table_name}', 'id')"
                ))
                seq_name = seq_result.scalar()
                if seq_name:
                    conn.execute(text(
                        f"SELECT setval('{seq_name}', :max_id)"
                    ), {"max_id": max_id})
                    logger.info("  %s: sequence reset to %d", table_name, max_id)
            except Exception as e:
                logger.warning("  %s: Could not reset sequence: %s", table_name, e)


def verify_migration(sqlite_conn, pg_engine):
    """Verify row counts match between source and destination."""
    logger.info("\n" + "=" * 60)
    logger.info("MIGRATION VERIFICATION")
    logger.info("=" * 60)

    all_match = True
    total_source = 0
    total_dest = 0

    for table_name in MIGRATION_ORDER:
        src_count = get_row_count(sqlite_conn, table_name)
        try:
            dst_count = get_pg_row_count(pg_engine, table_name)
        except Exception:
            dst_count = -1

        total_source += src_count
        total_dest += max(dst_count, 0)

        status = "OK" if src_count == dst_count else "MISMATCH"
        if src_count != dst_count:
            all_match = False

        logger.info("  %s %s: SQLite=%d, PostgreSQL=%d",
                    status, table_name, src_count, dst_count)

    logger.info("-" * 60)
    logger.info("  Total: SQLite=%d, PostgreSQL=%d", total_source, total_dest)

    if all_match:
        logger.info("\n  ALL TABLES MATCH! Migration verified successfully.")
    else:
        logger.warning("\n  Some tables have mismatched counts. "
                      "This may be due to ON CONFLICT DO NOTHING skipping duplicates, "
                      "or rows with NULL primary keys in SQLite.")

    return all_match


def main():
    # Verify we're connecting to PostgreSQL, not SQLite
    db_url = settings.DATABASE_URL
    if "sqlite" in db_url.lower():
        logger.error("DATABASE_URL points to SQLite! Set it to your Supabase PostgreSQL URL.")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("SQLite to Supabase PostgreSQL Migration")
    logger.info("=" * 60)
    logger.info("Source: %s", SQLITE_DB_PATH)
    logger.info("Destination: Supabase PostgreSQL (via pooler)")
    logger.info("")

    # Verify PostgreSQL tables exist
    existing = set(get_existing_tables())
    missing = [t for t in MIGRATION_ORDER if t not in existing]
    if missing:
        logger.error("Missing tables in PostgreSQL: %s", missing)
        logger.error("Run the application first to create tables via create_all().")
        sys.exit(1)

    logger.info("All 20 required tables exist in PostgreSQL.")
    logger.info("")

    # Connect to SQLite
    sqlite_conn = get_sqlite_connection()

    # Migrate each table
    logger.info("Migrating data...")
    total_migrated = 0
    for table_name in MIGRATION_ORDER:
        total_migrated += migrate_table(sqlite_conn, engine, table_name)

    logger.info("\nTotal rows migrated: %d", total_migrated)

    # Reset sequences
    reset_sequences(engine)

    # Verify
    verify_migration(sqlite_conn, engine)

    sqlite_conn.close()
    logger.info("\nMigration complete!")


if __name__ == "__main__":
    main()
