from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import date as _date
from typing import Optional
import io
import uuid

from database import get_db
from models import EmployeeIn
from auth import get_current_user, require_roles, clean
from utils import now_iso, write_audit, resolve_teams_for_date, get_active_kasubid_ids

router = APIRouter(tags=["Employees"])


@router.get("/employees")
async def list_employees(
    search: str = "",
    status: str = "",
    date: Optional[str] = None,
    exclude_kasubid: bool = False,
    user: dict = Depends(get_current_user),
):
    db = await get_db()
    query = db.table("employees").select("*")
    if status in ("ACTIVE", "INACTIVE"):
        query = query.eq("status", status)
    if search:
        import re
        clean_search = re.sub(r"[,.()%\"':\\]", "", search.strip())
        if clean_search:
            query = query.or_(f"nama.ilike.%{clean_search}%,nip.ilike.%{clean_search}%")
    res = await query.order("no").limit(5000).execute()
    employees = res.data or []

    ref_date = date or _date.today().isoformat()
    team_map = await resolve_teams_for_date(ref_date)
    kasubids = await get_active_kasubid_ids(ref_date)
    teams_res = await db.table("teams").select("*").execute()
    teams = {t["id"]: t for t in (teams_res.data or [])}

    for e in employees:
        is_kas = e["id"] in kasubids
        e["is_kasubid"] = is_kas
        if is_kas:
            e["current_team_id"] = None
            e["current_team_name"] = None
        else:
            tid = team_map.get(e["id"])
            e["current_team_id"] = tid
            e["current_team_name"] = teams.get(tid, {}).get("name") if tid else None

    if exclude_kasubid:
        employees = [e for e in employees if not e.get("is_kasubid")]

    return employees


@router.post("/employees")
async def create_employee(body: EmployeeIn, user: dict = Depends(require_roles("admin", "operator"))):
    db = await get_db()
    last_res = await db.table("employees").select("no").order("no", desc=True).limit(1).execute()
    last = last_res.data[0] if last_res.data else None
    no = (last["no"] + 1) if last else 1
    doc = {
        "id": str(uuid.uuid4()),
        "no": no,
        "nama": body.nama,
        "nip": body.nip,
        "pangkat": body.pangkat,
        "jabatan": body.jabatan,
        "status": "ACTIVE",
        "created_at": now_iso(),
    }
    await db.table("employees").insert(doc).execute()
    await write_audit(user, "Menambah pegawai", employee_name=body.nama, detail=body.nip)
    return clean(doc)


@router.put("/employees/{eid}")
async def update_employee(eid: str, body: EmployeeIn, user: dict = Depends(require_roles("admin", "operator"))):
    db = await get_db()
    existing = (await db.table("employees").select("id").eq("id", eid).execute()).data
    if not existing:
        raise HTTPException(status_code=404, detail="Pegawai tidak ditemukan")
    await db.table("employees").update({
        "nama": body.nama, "nip": body.nip, "pangkat": body.pangkat, "jabatan": body.jabatan,
    }).eq("id", eid).execute()
    await write_audit(user, "Mengubah data pegawai", employee_name=body.nama)
    return {"ok": True}


@router.post("/employees/{eid}/status")
async def toggle_employee_status(eid: str, user: dict = Depends(require_roles("admin", "operator"))):
    db = await get_db()
    res = await db.table("employees").select("*").eq("id", eid).execute()
    existing = res.data[0] if res.data else None
    if not existing:
        raise HTTPException(status_code=404, detail="Pegawai tidak ditemukan")
    new_status = "INACTIVE" if existing.get("status") == "ACTIVE" else "ACTIVE"
    await db.table("employees").update({"status": new_status}).eq("id", eid).execute()
    await write_audit(user, f"Mengubah status pegawai menjadi {new_status}", employee_name=existing["nama"])
    return {"ok": True, "status": new_status}


@router.get("/employees/{eid}/assignments")
async def employee_assignments(eid: str, user: dict = Depends(get_current_user)):
    db = await get_db()
    res = await db.table("team_assignments").select("*").eq("employee_id", eid).order("start_date", desc=True).limit(500).execute()
    assigns = res.data or []
    teams_res = await db.table("teams").select("*").execute()
    teams = {t["id"]: t for t in (teams_res.data or [])}
    for a in assigns:
        a["team_name"] = teams.get(a["team_id"], {}).get("name")
    return assigns


@router.post("/employees/import")
async def import_employees(file: UploadFile = File(...), user: dict = Depends(require_roles("admin"))):
    import pandas as pd

    filename = (file.filename or "").lower()
    if not (filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Format file harus berupa Excel (.xlsx atau .xls)")

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran file Excel melebihi batas maksimal 5 MB")

    try:
        df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca Excel: {e}")
    df.columns = [str(c).strip().lower() for c in df.columns]

    def pick(row, *keys):
        for k in keys:
            for col in df.columns:
                if k in col:
                    val = row.get(col)
                    if val is not None and str(val) != "nan":
                        return str(val).strip()
        return ""

    db = await get_db()
    last_res = await db.table("employees").select("no").order("no", desc=True).limit(1).execute()
    last = last_res.data[0] if last_res.data else None
    no = (last["no"] + 1) if last else 1

    docs_to_insert = []
    for _, row in df.iterrows():
        nama = pick(row, "nama", "name")
        if not nama:
            continue
        docs_to_insert.append({
            "id": str(uuid.uuid4()),
            "no": no,
            "nama": nama,
            "nip": pick(row, "nip"),
            "pangkat": pick(row, "pangkat", "golongan"),
            "jabatan": pick(row, "jabatan"),
            "status": "ACTIVE",
            "created_at": now_iso(),
        })
        no += 1

    if docs_to_insert:
        await db.table("employees").insert(docs_to_insert).execute()

    await write_audit(user, "Import data pegawai dari Excel", detail=f"{len(docs_to_insert)} pegawai")
    return {"inserted": len(docs_to_insert)}
