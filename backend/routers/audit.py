from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from datetime import datetime
import io
import json

from database import get_db, fetch_all
from auth import get_current_user, require_roles
from utils import now_iso, write_audit

router = APIRouter(tags=["Audit & Backup"])

BACKUP_TABLES = [
    {"name": "users", "label": "Pengguna Sistem"},
    {"name": "employees", "label": "Data Pegawai"},
    {"name": "teams", "label": "Data Regu"},
    {"name": "team_assignments", "label": "Penugasan Regu"},
    {"name": "team_commanders", "label": "Komandan Regu"},
    {"name": "sub_unit_assignments", "label": "Penugasan Kasubid"},
    {"name": "attendance", "label": "Data Absensi Harian"},
    {"name": "audit_logs", "label": "Log Audit Sistem"},
    {"name": "push_subscriptions", "label": "Langganan Web Push"},
]
ALLOWED_TABLE_NAMES = {t["name"] for t in BACKUP_TABLES}


@router.get("/audit")
async def audit_log(limit: int = 200, user: dict = Depends(require_roles("admin"))):
    capped_limit = min(max(1, limit), 500)
    db = await get_db()
    res = await db.table("audit_logs").select("*").order("timestamp", desc=True).limit(capped_limit).execute()
    return res.data or []


@router.get("/backup/tables")
async def get_backup_tables(user: dict = Depends(require_roles("admin"))):
    """
    Return list of tables available for backup.
    """
    return {"tables": BACKUP_TABLES}


@router.get("/backup/table/{table_name}")
async def get_backup_table_data(
    table_name: str,
    user: dict = Depends(require_roles("admin")),
):
    """
    Retrieve all rows for a single database table in JSON format.
    Scrub sensitive credentials (e.g. password_hash).
    """
    if table_name not in ALLOWED_TABLE_NAMES:
        raise HTTPException(status_code=400, detail=f"Tabel '{table_name}' tidak diizinkan untuk backup")

    db = await get_db()
    try:
        docs = await fetch_all(db.table(table_name).select("*"))
    except Exception as e:
        # If table doesn't exist yet or is empty, return empty list gracefully
        return {
            "table": table_name,
            "count": 0,
            "data": [],
            "error": str(e),
        }

    if table_name == "users":
        for d in docs:
            d.pop("password_hash", None)

    return {
        "table": table_name,
        "count": len(docs),
        "data": docs,
    }


@router.post("/backup/record-audit")
async def record_backup_audit(
    payload: dict = Body(...),
    user: dict = Depends(require_roles("admin")),
):
    """
    Called by frontend after client-side ZIP generation completes
    to record audit log and update last backup time.
    """
    tables_count = payload.get("total_tables", len(BACKUP_TABLES))
    records_count = payload.get("total_records", 0)
    filename = payload.get("filename", "backup_damkar.zip")
    detail = f"{tables_count} tabel ({records_count} baris data) diexport ke file ZIP ({filename})"

    await write_audit(user, "Backup database", detail=detail)
    return {"ok": True, "message": "Audit log backup berhasil dicatat"}


@router.get("/backup")
async def backup_legacy(user: dict = Depends(require_roles("admin"))):
    """
    Legacy monolithic JSON backup endpoint (fallback).
    """
    db = await get_db()
    dump = {}
    tables = [t["name"] for t in BACKUP_TABLES]
    for tbl in tables:
        try:
            docs = await fetch_all(db.table(tbl).select("*"))
            if tbl == "users":
                for d in docs:
                    d.pop("password_hash", None)
            dump[tbl] = docs
        except Exception:
            dump[tbl] = []

    dump["_meta"] = {"generated_at": now_iso(), "db": "supabase_postgresql"}
    data = json.dumps(dump, indent=2, default=str).encode("utf-8")
    fname = f"backup_damkar_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    await write_audit(user, "Backup database")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )
