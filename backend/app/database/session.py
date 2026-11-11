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
    """
    if not raw_url:
        raise ValueError("DATABASE_URL must be provided in backend/.env pointing to Supabase PostgreSQL.")

    clean_url = raw_url.strip().strip('"').strip("'")
    if clean_url.startswith("postgres://"):
        clean_url = "postgresql+psycopg2://" + clean_url[len("postgres://"):]
    elif clean_url.startswith("postgresql://") and not clean_url.startswith("postgresql+"):
        clean_url = "postgresql+psycopg2://" + clean_url[len("postgresql://"):]
    return clean_url


def create_configured_engine(db_url: str):
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


target_url = normalize_database_url(settings.DATABASE_URL)
sanitized_display = sanitize_database_url(target_url)
logger.info("Configuring database connection: %s", sanitized_display)

try:
    engine = _verify_engine(create_configured_engine(target_url), sanitized_display)
except Exception as exc:
    logger.error(
        "Could not connect to PostgreSQL (%s): %s. "
        "Set a valid DATABASE_URL in backend/.env.",
        sanitized_display,
        exc,
    )
    raise

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
