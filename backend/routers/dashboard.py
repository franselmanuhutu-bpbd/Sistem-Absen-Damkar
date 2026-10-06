from fastapi import APIRouter, Depends
from datetime import date as _date

from config import STATUSES, KASUBID_POSITIONS
from database import get_db
from auth import get_current_user
from utils import (
    resolve_teams_for_date,
    resolve_commander_for_date,
    resolve_kasubid_for_date
)

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard")
async def dashboard(date: str = None, user: dict = Depends(get_current_user)):
    db = await get_db()
    ref = date or _date.today().isoformat()
    teams = (await db.table("teams").select("*").order("order").limit(100).execute()).data or []
    team_map = await resolve_teams_for_date(ref)

    active_emps = (await db.table("employees").select("id").eq("status", "ACTIVE").limit(5000).execute()).data or []
    total_employees = len(active_emps)

    records = (await db.table("attendance").select("*").eq("date", ref).limit(10000).execute()).data or []
    rec_map = {r["employee_id"]: r["status"] for r in records}
    rec_team_map = {r["employee_id"]: r.get("team_id") for r in records if r.get("team_id")}

    def empty():
        return {s: 0 for s in STATUSES}

    totals = empty()
    per_team = {t["id"]: {"team": t, "members": 0, **empty()} for t in teams}
    for e in active_emps:
        tid = team_map.get(e["id"]) or rec_team_map.get(e["id"])
        if tid in per_team:
            per_team[tid]["members"] += 1
        st = rec_map.get(e["id"])
        if st in STATUSES:
            totals[st] += 1
            if tid in per_team:
                per_team[tid][st] += 1

    kasubid = []
    for pid, plabel in [("KASUBID1", "Kasubid 1"), ("KASUBID2", "Kasubid 2")]:
        eid = await resolve_kasubid_for_date(pid, ref)
        emp = (await db.table("employees").select("*").eq("id", eid).execute()).data if eid else None
        emp_obj = emp[0] if emp else None
        kasubid.append({"position_id": pid, "label": plabel, "employee_id": eid,
                        "nama": emp_obj["nama"] if emp_obj else None,
                        "status": "Aktif" if emp_obj else "Kosong"})

    for t in per_team.values():
        cid = await resolve_commander_for_date(t["team"]["id"], ref)
        cemp = (await db.table("employees").select("*").eq("id", cid).execute()).data if cid else None
        cemp_obj = cemp[0] if cemp else None
        t["commander_id"] = cid
        t["commander_name"] = cemp_obj["nama"] if cemp_obj else None

    return {
        "date": ref,
        "total_employees": total_employees,
        "totals": totals,
        "per_team": list(per_team.values()),
        "kasubid": kasubid,
    }


@router.get("/org-structure")
async def org_structure(date: str = None, user: dict = Depends(get_current_user)):
    db = await get_db()
    ref = date or _date.today().isoformat()
    teams = (await db.table("teams").select("*").order("order").limit(100).execute()).data or []
    team_map = await resolve_teams_for_date(ref)
    emps = {e["id"]: e for e in ((await db.table("employees").select("*").eq("status", "ACTIVE").limit(5000).execute()).data or [])}
    counts = {}
    for eid, tid in team_map.items():
        if eid in emps:
            counts[tid] = counts.get(tid, 0) + 1
    kasubid = []
    for pid, label in KASUBID_POSITIONS:
        eid = await resolve_kasubid_for_date(pid, ref)
        kasubid.append({"position_id": pid, "label": label, "employee_id": eid,
                        "nama": emps.get(eid, {}).get("nama") if eid else None,
                        "jabatan": emps.get(eid, {}).get("jabatan") if eid else None,
                        "status": "Aktif" if eid else "Kosong"})
    team_out = []
    for t in teams:
        cid = await resolve_commander_for_date(t["id"], ref)
        team_out.append({**t, "members_count": counts.get(t["id"], 0),
                         "commander_id": cid, "commander_name": emps.get(cid, {}).get("nama") if cid else None})
    return {"date": ref, "kasubid": kasubid, "teams": team_out}
