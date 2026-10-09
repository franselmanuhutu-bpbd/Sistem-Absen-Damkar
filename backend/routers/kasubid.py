from fastapi import APIRouter, HTTPException, Depends
from datetime import date as _date, timedelta
from typing import Optional
import uuid

from config import KASUBID_POSITIONS
from database import get_db
from models import KasubidIn
from auth import get_current_user, require_roles, clean
from utils import now_iso, write_audit, resolve_kasubid_for_date

router = APIRouter(tags=["Kasubid"])


@router.get("/kasubid")
async def kasubid_info(date: str = None, user: dict = Depends(get_current_user)):
    db = await get_db()
    ref = date or _date.today().isoformat()
    emps = {e["id"]: e for e in ((await db.table("employees").select("*").execute()).data or [])}
    out = []
    for pid, label in KASUBID_POSITIONS:
        eid = await resolve_kasubid_for_date(pid, ref)
        history = (await db.table("sub_unit_assignments").select("*").eq("position_id", pid).order("start_date", desc=True).limit(500).execute()).data or []
        for h in history:
            h["nama"] = emps.get(h["employee_id"], {}).get("nama")
        out.append({
            "position_id": pid, "label": label, "employee_id": eid,
            "nama": emps.get(eid, {}).get("nama") if eid else None,
            "jabatan": emps.get(eid, {}).get("jabatan") if eid else None,
            "status": "Aktif" if eid else "Kosong", "history": history,
        })
    return out


@router.post("/kasubid")
async def set_kasubid(body: KasubidIn, user: dict = Depends(require_roles("admin"))):
    if body.position_id not in ("KASUBID1", "KASUBID2"):
        raise HTTPException(status_code=400, detail="Posisi tidak valid")
    db = await get_db()
    emp = (await db.table("employees").select("*").eq("id", body.employee_id).execute()).data
    if not emp:
        raise HTTPException(status_code=404, detail="Pegawai tidak ditemukan")
    other = "KASUBID2" if body.position_id == "KASUBID1" else "KASUBID1"
    other_eid = await resolve_kasubid_for_date(other, body.start_date)
    if other_eid == body.employee_id:
        raise HTTPException(status_code=400, detail="Kasubid 1 dan Kasubid 2 tidak boleh orang yang sama pada periode yang sama.")
    prev_day = (_date.fromisoformat(body.start_date) - timedelta(days=1)).isoformat()
    active_subs = (await db.table("sub_unit_assignments").select("*").eq("position_id", body.position_id).is_("end_date", "null").execute()).data or []
    for a in active_subs:
        if a["start_date"] < body.start_date:
            await db.table("sub_unit_assignments").update({"end_date": prev_day, "updated_at": now_iso()}).eq("id", a["id"]).execute()
    doc = {
        "id": str(uuid.uuid4()), "position_id": body.position_id, "employee_id": body.employee_id,
        "start_date": body.start_date, "end_date": None, "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.table("sub_unit_assignments").insert(doc).execute()

    # Tutup penempatan regu jika pegawai sebelumnya berada di suatu regu
    active_team_assigns = (await db.table("team_assignments").select("*").eq("employee_id", body.employee_id).execute()).data or []
    for ta in active_team_assigns:
        if ta.get("end_date") is None or ta["end_date"] >= body.start_date:
            if ta["start_date"] < body.start_date:
                await db.table("team_assignments").update({"end_date": prev_day, "updated_at": now_iso()}).eq("id", ta["id"]).execute()
            else:
                await db.table("team_assignments").delete().eq("id", ta["id"]).execute()
    label = dict(KASUBID_POSITIONS)[body.position_id]
    prev_eid = await resolve_kasubid_for_date(body.position_id, prev_day)
    prev_emp = (await db.table("employees").select("*").eq("id", prev_eid).execute()).data if prev_eid else None
    prev_nama = prev_emp[0]["nama"] if prev_emp else "Kosong"
    await write_audit(
        user, f"Pergantian pejabat {label}", employee_name=emp[0]["nama"],
        old_status=None, new_status=None,
        detail=f"{prev_nama} \u2192 {emp[0]['nama']} (mulai {body.start_date})",
    )
    return clean(doc)


@router.post("/kasubid/vacate")
async def vacate_kasubid(body: KasubidIn, user: dict = Depends(require_roles("admin"))):
    """Kosongkan posisi Kasubid mulai tanggal tertentu (tutup assignment aktif, tanpa pejabat baru)."""
    if body.position_id not in ("KASUBID1", "KASUBID2"):
        raise HTTPException(status_code=400, detail="Posisi tidak valid")
    db = await get_db()
    prev_day = (_date.fromisoformat(body.start_date) - timedelta(days=1)).isoformat()
    prev_eid = await resolve_kasubid_for_date(body.position_id, body.start_date)
    closed = 0
    active_subs = (await db.table("sub_unit_assignments").select("*").eq("position_id", body.position_id).is_("end_date", "null").execute()).data or []
    for a in active_subs:
        if a["start_date"] <= body.start_date:
            await db.table("sub_unit_assignments").update({"end_date": prev_day, "updated_at": now_iso()}).eq("id", a["id"]).execute()
            closed += 1
    if closed == 0:
        raise HTTPException(status_code=400, detail="Tidak ada pejabat aktif untuk dikosongkan pada tanggal ini.")
    label = dict(KASUBID_POSITIONS)[body.position_id]
    prev_emp = (await db.table("employees").select("*").eq("id", prev_eid).execute()).data if prev_eid else None
    await write_audit(
        user, f"Mengosongkan posisi {label}",
        employee_name=prev_emp[0]["nama"] if prev_emp else None,
        detail=f"Posisi dikosongkan mulai {body.start_date}",
    )
    return {"ok": True}


@router.get("/kasubid/roster")
async def kasubid_roster(date: str, user: dict = Depends(get_current_user)):
    """Daftar Kasubid AKTIF pada tanggal tertentu beserta status absensinya (untuk Input Absensi Kasubid)."""
    db = await get_db()
    out = []
    for pid, label in KASUBID_POSITIONS:
        eid = await resolve_kasubid_for_date(pid, date)
        if not eid:
            continue
        emp_res = await db.table("employees").select("*").eq("id", eid).execute()
        if not emp_res.data:
            continue
        emp = emp_res.data[0]
        rec_res = await db.table("attendance").select("*").eq("employee_id", eid).eq("date", date).execute()
        rec = rec_res.data[0] if rec_res.data else None
        out.append({**emp, "position_id": pid, "position_label": label,
                    "status": rec["status"] if rec else None})
    return out
