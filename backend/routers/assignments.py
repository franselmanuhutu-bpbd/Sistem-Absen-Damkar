from fastapi import APIRouter, HTTPException, Depends
from datetime import date as _date, timedelta
import uuid

from database import get_db
from models import AssignmentIn
from auth import get_current_user, require_roles, clean
from utils import now_iso, write_audit

router = APIRouter(tags=["Assignments"])


@router.get("/assignments")
async def list_assignments(user: dict = Depends(get_current_user)):
    db = await get_db()
    res = await db.table("team_assignments").select("*").order("start_date", desc=True).limit(5000).execute()
    return res.data or []


@router.post("/assignments")
async def create_assignment(body: AssignmentIn, user: dict = Depends(require_roles("admin", "operator"))):
    """Assign/roll an employee to a team. Closes any open prior assignment the day before start."""
    db = await get_db()
    emp_res = await db.table("employees").select("*").eq("id", body.employee_id).execute()
    team_res = await db.table("teams").select("*").eq("id", body.team_id).execute()
    emp = emp_res.data[0] if emp_res.data else None
    team = team_res.data[0] if team_res.data else None
    if not emp or not team:
        raise HTTPException(status_code=404, detail="Pegawai / Regu tidak ditemukan")

    new_start = body.start_date
    new_end = body.end_date or "9999-12-31"
    existing_res = await db.table("team_assignments").select("*").eq("employee_id", body.employee_id).execute()
    existing = existing_res.data or []
    prev_day = (_date.fromisoformat(body.start_date) - timedelta(days=1)).isoformat()

    for a in existing:
        a_end = a.get("end_date") or "9999-12-31"
        if a.get("end_date") is None and a["start_date"] < new_start:
            continue
        if a["start_date"] <= new_end and a_end >= new_start:
            raise HTTPException(
                status_code=400,
                detail="Periode penempatan bertabrakan dengan assignment yang sudah ada. Perbaiki tanggal."
            )

    for a in existing:
        if a.get("end_date") is None and a["start_date"] < new_start:
            await db.table("team_assignments").update({
                "end_date": prev_day, "updated_at": now_iso()
            }).eq("id", a["id"]).execute()

    doc = {
        "id": str(uuid.uuid4()),
        "employee_id": body.employee_id,
        "team_id": body.team_id,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "created_at": now_iso(),
    }
    await db.table("team_assignments").insert(doc).execute()
    await write_audit(user, "Penempatan / Rolling regu", employee_name=emp["nama"],
                      detail=f"{team['name']} mulai {body.start_date}")
    return clean(doc)


@router.delete("/assignments/{aid}")
async def delete_assignment(aid: str, user: dict = Depends(require_roles("admin"))):
    db = await get_db()
    await db.table("team_assignments").delete().eq("id", aid).execute()
    await write_audit(user, "Menghapus penempatan regu")
    return {"ok": True}


@router.post("/assignments/reset")
async def reset_assignments(team_id: str = None, user: dict = Depends(require_roles("admin"))):
    """Kosongkan seluruh penempatan regu (atau satu regu) agar bisa ditata ulang dari awal."""
    db = await get_db()
    if team_id:
        res = await db.table("team_assignments").delete().eq("team_id", team_id).execute()
    else:
        res = await db.table("team_assignments").delete().neq("id", "").execute()
    deleted_count = len(res.data) if res.data else 0
    scope = "regu terpilih" if team_id else "semua regu"
    await write_audit(user, "Reset penempatan regu", detail=f"{deleted_count} penempatan dihapus ({scope})")
    return {"deleted": deleted_count}
