from fastapi import APIRouter, HTTPException, Depends
from datetime import date as _date, timedelta
import uuid

from database import get_db
from models import AssignmentIn, BatchAssignmentIn
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


@router.post("/assignments/batch")
async def create_batch_assignment(body: BatchAssignmentIn, user: dict = Depends(require_roles("admin", "operator"))):
    """Batch assign multiple employees to a team. Closes prior open assignments before start_date."""
    if not body.employee_ids:
        raise HTTPException(status_code=400, detail="Daftar pegawai tidak boleh kosong")

    db = await get_db()
    team_res = await db.table("teams").select("*").eq("id", body.team_id).execute()
    team = team_res.data[0] if team_res.data else None
    if not team:
        raise HTTPException(status_code=404, detail="Regu tujuan tidak ditemukan")

    # Fetch employees
    emp_res = await db.table("employees").select("id, nama").in_("id", body.employee_ids).execute()
    emps = {e["id"]: e["nama"] for e in (emp_res.data or [])}

    new_start = body.start_date
    new_end = body.end_date or "9999-12-31"
    prev_day = (_date.fromisoformat(body.start_date) - timedelta(days=1)).isoformat()

    # Fetch existing assignments for these employees
    existing_res = await db.table("team_assignments").select("*").in_("employee_id", body.employee_ids).execute()
    existing_by_emp = {}
    for a in (existing_res.data or []):
        existing_by_emp.setdefault(a["employee_id"], []).append(a)

    to_close_ids = []
    docs_to_insert = []
    names_assigned = []

    for eid in body.employee_ids:
        if eid not in emps:
            continue
        existing = existing_by_emp.get(eid, [])
        for a in existing:
            a_end = a.get("end_date") or "9999-12-31"
            if a.get("end_date") is None and a["start_date"] < new_start:
                continue
            if a["start_date"] <= new_end and a_end >= new_start:
                emp_name = emps.get(eid, eid)
                raise HTTPException(
                    status_code=400,
                    detail=f"Periode penempatan bertabrakan untuk pegawai {emp_name}. Perbaiki tanggal."
                )

        for a in existing:
            if a.get("end_date") is None and a["start_date"] < new_start:
                to_close_ids.append(a["id"])

        docs_to_insert.append({
            "id": str(uuid.uuid4()),
            "employee_id": eid,
            "team_id": body.team_id,
            "start_date": body.start_date,
            "end_date": body.end_date,
            "created_at": now_iso(),
        })
        names_assigned.append(emps.get(eid, eid))

    # Close previous open assignments in batch
    for aid in to_close_ids:
        await db.table("team_assignments").update({
            "end_date": prev_day, "updated_at": now_iso()
        }).eq("id", aid).execute()

    if docs_to_insert:
        await db.table("team_assignments").insert(docs_to_insert).execute()

    emp_preview = ", ".join(names_assigned[:3])
    if len(names_assigned) > 3:
        emp_preview += f" dan {len(names_assigned) - 3} pegawai lainnya"

    await write_audit(
        user,
        "Penempatan / Rolling regu batch",
        employee_name=emp_preview,
        detail=f"{len(docs_to_insert)} pegawai ke {team['name']} mulai {body.start_date}"
    )

    return {
        "count": len(docs_to_insert),
        "team_id": body.team_id,
        "team_name": team["name"],
        "start_date": body.start_date,
    }


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
