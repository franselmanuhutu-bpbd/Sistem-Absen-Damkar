from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import uuid

from config import STATUSES
from database import get_db
from models import BatchAttendanceIn
from auth import get_current_user, require_roles
from utils import now_iso, write_audit, resolve_teams_for_date

router = APIRouter(tags=["Attendance"])


@router.get("/attendance/roster")
async def attendance_roster(date: str, team_id: str, user: dict = Depends(get_current_user)):
    db = await get_db()
    team_map = await resolve_teams_for_date(date)
    ids = [eid for eid, tid in team_map.items() if tid == team_id]
    if not ids:
        return []
    emps_res = await db.table("employees").select("*").in_("id", ids).eq("status", "ACTIVE").order("no").execute()
    emps = emps_res.data or []

    rec_res = await db.table("attendance").select("*").eq("date", date).in_("employee_id", ids).execute()
    records = rec_res.data or []
    status_map = {r["employee_id"]: r["status"] for r in records}
    for e in emps:
        e["status"] = status_map.get(e["id"])
    return emps


@router.post("/attendance/batch")
async def batch_attendance(body: BatchAttendanceIn, user: dict = Depends(require_roles("admin", "operator"))):
    if body.status not in STATUSES:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    db = await get_db()
    team_map = await resolve_teams_for_date(body.date)
    count = 0
    for eid in body.employee_ids:
        existing_res = await db.table("attendance").select("*").eq("employee_id", eid).eq("date", body.date).execute()
        existing = existing_res.data[0] if existing_res.data else None
        old = existing["status"] if existing else None
        if old == body.status:
            continue
        doc = {
            "employee_id": eid,
            "date": body.date,
            "status": body.status,
            "team_id": team_map.get(eid),
            "updated_at": now_iso(),
            "updated_by": user["email"],
        }
        if existing:
            await db.table("attendance").update(doc).eq("employee_id", eid).eq("date", body.date).execute()
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = now_iso()
            await db.table("attendance").insert(doc).execute()

        emp_res = await db.table("employees").select("nama").eq("id", eid).execute()
        emp_name = emp_res.data[0]["nama"] if emp_res.data else eid
        await write_audit(user, "Mengubah absensi", employee_name=emp_name,
                          date=body.date, old_status=old, new_status=body.status)
        count += 1
    return {"updated": count}


@router.get("/attendance/day")
async def attendance_day(date: str, team_id: str = None, user: dict = Depends(get_current_user)):
    db = await get_db()
    q = db.table("attendance").select("*").eq("date", date)
    if team_id:
        q = q.eq("team_id", team_id)
    records = (await q.execute()).data or []

    emp_ids = [r["employee_id"] for r in records]
    emps = {}
    if emp_ids:
        emps_data = (await db.table("employees").select("*").in_("id", emp_ids).execute()).data or []
        emps = {e["id"]: e for e in emps_data}

    teams = {t["id"]: t for t in ((await db.table("teams").select("*").execute()).data or [])}

    out = []
    for r in records:
        e = emps.get(r["employee_id"], {})
        out.append({
            "nama": e.get("nama"), "nip": e.get("nip"), "jabatan": e.get("jabatan"),
            "regu": teams.get(r.get("team_id"), {}).get("name"), "status": r["status"],
        })
    out.sort(key=lambda x: (x.get("regu") or "", x.get("nama") or ""))
    return out
