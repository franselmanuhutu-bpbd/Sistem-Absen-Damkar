from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime
import io
import json

from database import get_db, fetch_all
from auth import get_current_user, require_roles
from utils import now_iso, write_audit

router = APIRouter(tags=["Audit & Backup"])


@router.get("/audit")
async def audit_log(limit: int = 200, user: dict = Depends(get_current_user)):
    db = await get_db()
    res = await db.table("audit_logs").select("*").order("timestamp", desc=True).limit(limit).execute()
    return res.data or []


@router.get("/backup")
async def backup(user: dict = Depends(require_roles("admin"))):
    db = await get_db()
    dump = {}
    tables = [
        "users", "employees", "teams", "team_assignments",
        "team_commanders", "sub_unit_assignments", "attendance", "audit_logs"
    ]
    for tbl in tables:
        docs = await fetch_all(db.table(tbl).select("*"))
        if tbl == "users":
            for d in docs:
                d.pop("password_hash", None)
        dump[tbl] = docs
    dump["_meta"] = {"generated_at": now_iso(), "db": "supabase_postgresql"}
    data = json.dumps(dump, indent=2, default=str).encode("utf-8")
    fname = f"backup_damkar_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    await write_audit(user, "Backup database")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )
