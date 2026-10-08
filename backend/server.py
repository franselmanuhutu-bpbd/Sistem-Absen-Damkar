import os
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import httpx
import httpcore

from config import logger
from database import ensure_schema, reset_db_client
from routers import (
    auth,
    users,
    teams,
    employees,
    assignments,
    attendance,
    dashboard,
    recap,
    calendar,
    kasubid,
    me,
    audit,
    exports,
    notifications,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    On startup, automatically ensures the database schema exists across providers,
    creating tables and indexes if missing, and seeding if empty.
    """
    logger.info("Initializing database connection and schema verification...")
    try:
        ensure_schema()
    except Exception as exc:
        logger.warning(f"Notice during startup schema verification: {exc}")
    yield
    logger.info("Server shutting down.")


app = FastAPI(
    title="Sistem Informasi Absensi DAMKAR Mimika",
    description="Backend API for DAMKAR Attendance System (PostgreSQL / Supabase)",
    version="2.0.0",
    lifespan=lifespan,
)

# API Router with prefix /api
api = APIRouter(prefix="/api")


@api.get("/")
async def api_root():
    return {"message": "DAMKAR Absensi API (Supabase PostgreSQL)"}


@api.get("/health")
async def health_check():
    """Lightweight health & database check with latency measurement."""
    from time import perf_counter
    from database import get_db

    db_status = "connected"
    t0 = perf_counter()
    try:
        db = await get_db()
        await db.table("teams").select("id").limit(1).execute()
        latency_ms = round((perf_counter() - t0) * 1000, 1)
    except Exception as e:
        db_status = "error"
        latency_ms = round((perf_counter() - t0) * 1000, 1)

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "latency_ms": latency_ms,
    }


# Include all modular routers
api.include_router(auth.router)
api.include_router(users.router)
api.include_router(teams.router)
api.include_router(employees.router)
api.include_router(assignments.router)
api.include_router(attendance.router)
api.include_router(dashboard.router)
api.include_router(recap.router)
api.include_router(calendar.router)
api.include_router(kasubid.router)
api.include_router(me.router)
api.include_router(audit.router)
api.include_router(exports.router)
api.include_router(notifications.router)

# Mount /api router and root
app.include_router(api)


@app.exception_handler(httpx.ConnectError)
@app.exception_handler(httpx.ConnectTimeout)
@app.exception_handler(httpcore.ConnectError)
@app.exception_handler(httpcore.ConnectTimeout)
async def db_connection_exception_handler(request: Request, exc: Exception):
    logger.warning(f"Database network exception on {request.method} {request.url.path}: {exc}. Resetting client...")
    await reset_db_client()
    return JSONResponse(
        status_code=503,
        content={"detail": "Koneksi ke database sedang terganggu. Silakan coba beberapa saat lagi."},
    )


@app.get("/")
async def root():
    return {"message": "DAMKAR Absensi API (Supabase PostgreSQL)"}


# CORS Middleware
ALLOWED_ORIGINS = [
    "https://sistem-absen-damkar.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# Allow additional origins from environment variable if set
custom_origins = os.environ.get("ALLOWED_ORIGINS")
if custom_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in custom_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https:\/\/sistem-absen-damkar.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
