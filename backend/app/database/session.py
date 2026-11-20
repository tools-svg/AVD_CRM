import logging
import re
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger("avd.database")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [DB] %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

Base = declarative_base()

REQUIRED_TABLES = [
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
    "project_finances",
    "project_payments",
    "user_sessions",
]


def sanitize_database_url(raw_url: str) -> str:
    if not raw_url:
        return "(empty)"
    try:
        return make_url(raw_url).render_as_string(hide_password=True)
    except Exception:
        return re.sub(r":([^:@/]+)@", ":****@", raw_url)


def normalize_database_url(raw_url: str) -> str:
    """
    Normalizes PostgreSQL connection strings for SQLAlchemy + psycopg2.
    Supabase URIs typically begin with postgresql:// or postgres://.
    If no DATABASE_URL is configured, gracefully falls back to local SQLite.
    """
    if not raw_url:
        logger.warning("DATABASE_URL is not set. Defaulting to local SQLite database: sqlite:///./avd_crm.db")
        return "sqlite:///./avd_crm.db"

    clean_url = raw_url.strip().strip('"').strip("'")
    if clean_url.startswith("postgres://"):
        clean_url = "postgresql+psycopg2://" + clean_url[len("postgres://"):]
    elif clean_url.startswith("postgresql://") and not clean_url.startswith("postgresql+"):
        clean_url = "postgresql+psycopg2://" + clean_url[len("postgresql://"):]
    return clean_url


def create_configured_engine(db_url: str):
    if db_url.startswith("sqlite"):
        from sqlalchemy.pool import StaticPool
        return create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

    connect_args = {}
    if "sslmode" not in db_url.lower() and "localhost" not in db_url and "127.0.0.1" not in db_url:
        connect_args = {"sslmode": "require"}

    return create_engine(
        db_url,
        connect_args=connect_args,
        pool_size=5,
        max_overflow=10,
        pool_recycle=300,
        pool_pre_ping=True,
    )


def _verify_engine(candidate_engine, display_url: str):
    with candidate_engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info("Database connection verified successfully: %s", display_url)
    return candidate_engine


def ensure_schema_compatibility(engine_instance):
    """
    Ensure existing tables have TEXT columns and newly required columns for
    updates approval workflow and rich notifications.
    Supports both PostgreSQL and SQLite seamlessly.
    """
    try:
        insp = inspect(engine_instance)
        table_names = set(insp.get_table_names())
        url_str = str(engine_instance.url)
        is_postgres = "postgresql" in url_str or "postgres" in url_str

        # PostgreSQL TEXT expansions
        if is_postgres:
            statements = [
                "ALTER TABLE companies ALTER COLUMN logo_url TYPE TEXT;",
                "ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;",
                "ALTER TABLE user_sessions ALTER COLUMN ip_address TYPE TEXT;",
                "ALTER TABLE attachments ALTER COLUMN file_path TYPE TEXT;",
            ]
            for stmt in statements:
                try:
                    with engine_instance.begin() as conn:
                        conn.execute(text(stmt))
                except Exception as exc:
                    logger.debug("Schema compatibility note (%s): %s", stmt, exc)

        # Updates table new columns
        if "updates" in table_names:
            update_cols = {c["name"] for c in insp.get_columns("updates")}
            new_update_cols = [
                ("status_change", "VARCHAR(50)"),
                ("progress_change", "FLOAT"),
                ("approval_status", "VARCHAR(20) DEFAULT 'accepted'"),
                ("reviewed_by_id", "INTEGER"),
                ("reviewed_at", "TIMESTAMP"),
                ("rejection_reason", "TEXT"),
            ]
            for col_name, col_type in new_update_cols:
                if col_name not in update_cols:
                    stmt = f"ALTER TABLE updates ADD COLUMN {col_name} {col_type};"
                    try:
                        with engine_instance.begin() as conn:
                            conn.execute(text(stmt))
                        logger.info("Added column %s to updates table", col_name)
                    except Exception as exc:
                        logger.debug("Failed adding column %s to updates: %s", col_name, exc)

        if "projects" in table_names:
            project_cols = {c["name"] for c in insp.get_columns("projects")}
            added_status_override = False
            if "status_override" not in project_cols:
                try:
                    with engine_instance.begin() as conn:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN status_override VARCHAR(50)"))
                    logger.info("Added column status_override to projects table")
                    added_status_override = True
                except Exception as exc:
                    logger.warning("Failed adding column status_override to projects: %s", exc)
            if added_status_override:
                try:
                    with engine_instance.begin() as conn:
                        conn.execute(text(
                            "UPDATE projects SET status_override = status "
                            "WHERE status IN ('Review', 'On Hold', 'Cancelled')"
                        ))
                except Exception as exc:
                    logger.warning("Failed to preserve existing project status overrides: %s", exc)

        # Notifications table new columns
        if "notifications" in table_names:
            notif_cols = {c["name"] for c in insp.get_columns("notifications")}
            new_notif_cols = [
                ("related_type", "VARCHAR(50)"),
                ("related_id", "INTEGER"),
                ("action_status", "VARCHAR(20)"),
            ]
            for col_name, col_type in new_notif_cols:
                if col_name not in notif_cols:
                    stmt = f"ALTER TABLE notifications ADD COLUMN {col_name} {col_type};"
                    try:
                        with engine_instance.begin() as conn:
                            conn.execute(text(stmt))
                        logger.info("Added column %s to notifications table", col_name)
                    except Exception as exc:
                        logger.debug("Failed adding column %s to notifications: %s", col_name, exc)

    except Exception as exc:
        logger.warning("ensure_schema_compatibility encountered an error: %s", exc)


target_url = normalize_database_url(settings.DATABASE_URL)
sanitized_display = sanitize_database_url(target_url)
logger.info("Configuring database connection: %s", sanitized_display)

try:
    engine = _verify_engine(create_configured_engine(target_url), sanitized_display)
except Exception as exc:
    sqlite_fallback = "sqlite:///./avd_crm.db"
    logger.warning(
        "Could not connect to primary database (%s): %s. Falling back to local SQLite: %s",
        sanitized_display,
        exc,
        sqlite_fallback,
    )
    engine = _verify_engine(create_configured_engine(sqlite_fallback), sqlite_fallback)

ensure_schema_compatibility(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@event.listens_for(SessionLocal, "after_flush")
def _log_flush(session, _flush_context):
    inserted = len(session.new)
    updated = len(session.dirty)
    deleted = len(session.deleted)
    if inserted or updated or deleted:
        new_types = sorted({obj.__tablename__ for obj in session.new if hasattr(obj, "__tablename__")})
        dirty_types = sorted({obj.__tablename__ for obj in session.dirty if hasattr(obj, "__tablename__")})
        deleted_types = sorted({obj.__tablename__ for obj in session.deleted if hasattr(obj, "__tablename__")})
        logger.info(
            "DB flush: inserted=%s%s updated=%s%s deleted=%s%s",
            inserted,
            f" {new_types}" if new_types else "",
            updated,
            f" {dirty_types}" if dirty_types else "",
            deleted,
            f" {deleted_types}" if deleted_types else "",
        )


def get_existing_tables():
    return inspect(engine).get_table_names()


def get_missing_tables():
    existing = set(get_existing_tables())
    return [name for name in REQUIRED_TABLES if name not in existing]


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
