from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import logger
from database import ensure_schema
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


@app.get("/")
async def root():
    return {"message": "DAMKAR Absensi API (Supabase PostgreSQL)"}


# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins="*",
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
