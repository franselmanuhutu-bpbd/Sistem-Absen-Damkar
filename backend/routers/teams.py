from fastapi import APIRouter, HTTPException, Depends
from datetime import date as _date, timedelta
import uuid

from database import get_db
from models import TeamRenameIn, CommanderIn
from auth import get_current_user, require_roles, clean
from utils import (
    now_iso, write_audit, resolve_teams_for_date,
    resolve_commander_for_date
)

router = APIRouter(tags=["Teams"])


@router.get("/teams")
async def list_teams(user: dict = Depends(get_current_user)):
    db = await get_db()
    res = await db.table("teams").select("*").order("order").limit(100).execute()
    return res.data or []


@router.put("/teams/{team_id}/rename")
async def rename_team(team_id: str, body: TeamRenameIn, user: dict = Depends(require_roles("admin"))):
    db = await get_db()
    res = await db.table("teams").select("*").eq("id", team_id).execute()
    team = res.data[0] if res.data else None
    if not team:
        raise HTTPException(status_code=404, detail="Regu tidak ditemukan")
    old = team["name"]
    await db.table("teams").update({"name": body.name}).eq("id", team_id).execute()
    await write_audit(user, "Rename regu", detail=f"{old} \u2192 {body.name}")
    return {"ok": True}


@router.get("/teams/{team_id}/members")
async def team_members(team_id: str, date: str = None, user: dict = Depends(get_current_user)):
    db = await get_db()
    ref = date or _date.today().isoformat()
    team_map = await resolve_teams_for_date(ref)
    ids = [eid for eid, tid in team_map.items() if tid == team_id]
    if not ids:
        return []
    res = await db.table("employees").select("*").in_("id", ids).eq("status", "ACTIVE").order("no").execute()
    return res.data or []


@router.get("/teams/{team_id}/commanders")
async def commander_history(team_id: str, user: dict = Depends(get_current_user)):
    db = await get_db()
    rows = (await db.table("team_commanders").select("*").eq("team_id", team_id).order("start_date", desc=True).limit(500).execute()).data or []
    emps = {e["id"]: e for e in ((await db.table("employees").select("*").execute()).data or [])}
    for r in rows:
        r["nama"] = emps.get(r["employee_id"], {}).get("nama")
    return rows


@router.post("/commanders")
async def set_commander(body: CommanderIn, user: dict = Depends(require_roles("admin", "operator"))):
    db = await get_db()
    emp = (await db.table("employees").select("*").eq("id", body.employee_id).execute()).data
    team = (await db.table("teams").select("*").eq("id", body.team_id).execute()).data
    if not emp or not team:
        raise HTTPException(status_code=404, detail="Pegawai / Regu tidak ditemukan")
    prev_day = (_date.fromisoformat(body.start_date) - timedelta(days=1)).isoformat()
    existing = (await db.table("team_commanders").select("*").eq("team_id", body.team_id).execute()).data or []
    for a in existing:
        a_end = a.get("end_date") or "9999-12-31"
        if a.get("end_date") is None and a["start_date"] <= body.start_date:
            continue
        if a["start_date"] <= "9999-12-31" and a_end >= body.start_date:
            raise HTTPException(status_code=400, detail="Periode komandan bertabrakan dengan data sebelumnya.")
    for a in existing:
        if a.get("end_date") is None and a["start_date"] <= body.start_date:
            await db.table("team_commanders").update({"end_date": prev_day, "updated_at": now_iso()}).eq("id", a["id"]).execute()
    doc = {"id": str(uuid.uuid4()), "team_id": body.team_id, "employee_id": body.employee_id,
           "start_date": body.start_date, "end_date": None, "created_at": now_iso(), "updated_at": now_iso()}
    await db.table("team_commanders").insert(doc).execute()
    await write_audit(user, "Menetapkan Komandan Regu", employee_name=emp[0]["nama"],
                      detail=f"{team[0]['name']} mulai {body.start_date}")
    return clean(doc)


@router.get("/teams/{team_id}/detail")
async def team_detail(team_id: str, date: str = None, user: dict = Depends(get_current_user)):
    db = await get_db()
    ref = date or _date.today().isoformat()
    team_res = await db.table("teams").select("*").eq("id", team_id).execute()
    if not team_res.data:
        raise HTTPException(status_code=404, detail="Regu tidak ditemukan")
    team = team_res.data[0]
    team_map = await resolve_teams_for_date(ref)
    today_team_map = (
        await resolve_teams_for_date(_date.today().isoformat())
        if ref != _date.today().isoformat()
        else team_map
    )

    att_res = await db.table("attendance").select("employee_id, team_id").eq("date", ref).eq("team_id", team_id).execute()
    att_eids = {r["employee_id"] for r in (att_res.data or []) if r.get("employee_id")}

    assigned_eids = {eid for eid, tid in team_map.items() if tid == team_id}
    today_eids = {eid for eid, tid in today_team_map.items() if tid == team_id}
    if att_eids:
        target_ids = att_eids
    elif assigned_eids:
        target_ids = assigned_eids
    else:
        target_ids = today_eids
    ids = list(target_ids)

    members = []
    if ids:
        members = (await db.table("employees").select("*").in_("id", ids).eq("status", "ACTIVE").order("no").limit(5000).execute()).data or []
    cid = await resolve_commander_for_date(team_id, ref)
    if not cid and ref != _date.today().isoformat():
        cid = await resolve_commander_for_date(team_id, _date.today().isoformat())
    cemp = (await db.table("employees").select("*").eq("id", cid).execute()).data if cid else None
    cemp_obj = cemp[0] if cemp else None
    for m in members:
        m["is_commander"] = (m["id"] == cid)
    return {"team": team, "commander": {"employee_id": cid, "nama": cemp_obj["nama"] if cemp_obj else None},
            "members": members, "date": ref}


@router.get("/teams/{team_id}/history")
async def team_history(team_id: str, user: dict = Depends(get_current_user)):
    db = await get_db()
    assigns = (await db.table("team_assignments").select("*").eq("team_id", team_id).limit(5000).execute()).data or []
    emps = {e["id"]: e for e in ((await db.table("employees").select("*").execute()).data or [])}
    events = []
    for a in assigns:
        nm = emps.get(a["employee_id"], {}).get("nama", "-")
        events.append({"date": a["start_date"], "nama": nm, "aksi": "Masuk", "keterangan": "Penempatan / rolling masuk"})
        if a.get("end_date"):
            nxt = (_date.fromisoformat(a["end_date"]) + timedelta(days=1)).isoformat()
            events.append({"date": nxt, "nama": nm, "aksi": "Keluar", "keterangan": "Rolling keluar"})
    events.sort(key=lambda x: x["date"], reverse=True)
    return events
