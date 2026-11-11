import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.database.session import (
    Base,
    engine,
    get_missing_tables,
    get_existing_tables,
    sanitized_display,
)
import app.models.all_models 
from app.database.seed import seed_database
from app.api import (
    auth,
    companies,
    users,
    projects,
    modules,
    sticky_notes,
    notifications,
    gantt,
    statistics,
    public,
    ui_config,
    search,
    upload,
    finances
)

logger = logging.getLogger("avd.server")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [SERVER] %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# Initialize database schema and seeds
try:
    logger.info("Initializing database schema on %s", sanitized_display)
    Base.metadata.create_all(bind=engine)
    missing = get_missing_tables()
    if missing:
        logger.error("Required tables are still missing after create_all: %s", missing)
    else:
        logger.info("Database schema initialized. Tables: %s", get_existing_tables())
except Exception as e:
    logger.error("Database schema initialization failed: %s", e, exc_info=True)
    raise

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
try:
    seed_database()
except Exception as e:
    logger.error("Database seed failed: %s", e, exc_info=True)
    raise

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc"
)

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(
        "Database error executing %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "A database operation error occurred. Verify DATABASE_URL, table schema, and backend logs."
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, (HTTPException, StarletteHTTPException, RequestValidationError)):
        raise exc
    logger.error(
        "Unhandled error executing %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. See backend logs for the traceback."},
    )

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads static directory
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers (Tickets removed per Section 3; Search added per Section 9)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(companies.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(projects.router, prefix=settings.API_V1_STR)
app.include_router(modules.router, prefix=settings.API_V1_STR)
app.include_router(sticky_notes.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(gantt.router, prefix=settings.API_V1_STR)
app.include_router(statistics.router, prefix=settings.API_V1_STR)
app.include_router(public.router, prefix=settings.API_V1_STR)
app.include_router(ui_config.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(upload.router, prefix=settings.API_V1_STR)
app.include_router(finances.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }


@app.get(f"{settings.API_V1_STR}/health")
def health():
    missing = get_missing_tables()
    dialect = engine.dialect.name
    connected = True
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        connected = False
        logger.error("Health check connection failed: %s", exc, exc_info=True)
    return {
        "status": "ok" if connected and not missing else "degraded",
        "database": {
            "connected": connected,
            "dialect": dialect,
            "url": sanitized_display,
            "tables": get_existing_tables(),
            "missing_tables": missing,
        },
        "auth": "custom_fastapi_jwt",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
