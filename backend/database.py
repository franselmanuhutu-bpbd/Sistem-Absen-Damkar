import os
import re
from pathlib import Path
from typing import Optional, List
import logging
from supabase import create_async_client, create_client, AsyncClient, Client

from config import SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL, logger

_db_client: Optional[AsyncClient] = None
_sync_client: Optional[Client] = None


async def get_db() -> AsyncClient:
    """Return an asynchronous Supabase PostgREST client."""
    global _db_client
    if _db_client is None:
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in .env")
        _db_client = await create_async_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    return _db_client


def get_sync_db() -> Client:
    """Return a synchronous Supabase PostgREST client."""
    global _sync_client
    if _sync_client is None:
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in .env")
        _sync_client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    return _sync_client


async def fetch_all(query_builder, chunk_size: int = 1000) -> list:
    """Fetch all rows from a PostgREST query using pagination to avoid row limits."""
    rows = []
    start = 0
    while True:
        res = await query_builder.range(start, start + chunk_size - 1).execute()
        data = res.data or []
        rows.extend(data)
        if len(data) < chunk_size:
            break
        start += len(data)
    return rows


def execute_sql_file(sql_path: Path, connection_url: str):
    """Execute raw SQL statements from a file using psycopg."""
    import psycopg

    clean_url = re.sub(r"^(postgres|postgresql\+asyncpg)://", "postgresql://", connection_url)
    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    logger.info(f"Applying schema DDL from {sql_path.name} to PostgreSQL...")
    with psycopg.connect(clean_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql_content)
    logger.info("Schema DDL applied successfully!")


def ensure_schema():
    """
    Ensure all tables, indexes, and constraints exist every time the server starts.
    If moving to other PostgreSQL providers (Neon, Railway, AWS RDS, Docker, Supabase Direct),
    providing DATABASE_URL will automatically execute schema.sql on startup.
    """
    schema_file = Path(__file__).parent / "schema.sql"

    # 1. If DATABASE_URL is configured, execute DDL directly via psycopg (Universal across all Postgres providers)
    if DATABASE_URL:
        try:
            logger.info("DATABASE_URL detected. Ensuring schema via direct PostgreSQL connection...")
            if schema_file.exists():
                execute_sql_file(schema_file, DATABASE_URL)
            else:
                logger.warning(f"Schema file not found at {schema_file}")
        except Exception as exc:
            logger.error(f"Error executing schema via DATABASE_URL: {exc}")

    # 2. Verify or seed via Supabase Client
    if SUPABASE_URL and SUPABASE_SECRET_KEY:
        try:
            sync_client = get_sync_db()
            logger.info("Verifying tables in database...")
            # Ping primary tables
            required_tables = ["users", "teams", "employees", "team_assignments", "team_commanders", "sub_unit_assignments", "attendance", "audit_logs"]
            missing_tables = []
            for tbl in required_tables:
                try:
                    sync_client.table(tbl).select("id").limit(1).execute()
                except Exception as tbl_exc:
                    missing_tables.append((tbl, str(tbl_exc)))

            if missing_tables:
                logger.warning(f"Some tables could not be verified via PostgREST: {[t[0] for t in missing_tables]}")
                if not DATABASE_URL:
                    logger.info("Tip: You can set DATABASE_URL=postgresql://... in .env to enable automatic DDL execution on startup.")
            else:
                logger.info("All required database tables verified.")
        except Exception as exc:
            logger.warning(f"Database verification notice: {exc}")
