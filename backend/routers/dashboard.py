import asyncio
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
    today_iso = _date.today().isoformat()

    # Query latest date with attendance records on or before today
    latest_rec = (
        await db.table("attendance")
        .select("date")
        .lte("date", today_iso)
        .order("date", desc=True)
        .limit(1)
        .execute()
    ).data or []
    latest_date = latest_rec[0]["date"] if latest_rec else None

    # Check if today has attendance records
    today_records = (
        await db.table("attendance")
        .select("id")
        .eq("date", today_iso)
        .limit(1)
        .execute()
    ).data or []
    has_attendance_today = len(today_records) > 0

    # Determine reference date
    is_fallback = False
    cleaned_date = date.strip() if date else None
    if cleaned_date:
        ref = cleaned_date
    else:
        if has_attendance_today or not latest_date:
            ref = today_iso
        else:
            ref = latest_date
            is_fallback = True

    teams = (await db.table("teams").select("*").order("order").limit(100).execute()).data or []
    team_map = await resolve_teams_for_date(ref)

    # Fetch active employees with id and nama to avoid N+1 queries
    active_emps = (await db.table("employees").select("id, nama").eq("status", "ACTIVE").limit(5000).execute()).data or []
    active_ids = {e["id"] for e in active_emps}
    emp_names = {e["id"]: e.get("nama") for e in active_emps}
    total_employees = len(active_emps)

    records = (await db.table("attendance").select("*").eq("date", ref).limit(10000).execute()).data or []

    rec_team_map = {
        r["employee_id"]: r["team_id"]
        for r in records
        if r.get("team_id") and r.get("employee_id") in active_ids
    }
    today_team_map = (
        await resolve_teams_for_date(today_iso)
        if ref != today_iso
        else team_map
    )

    def empty():
        return {s: 0 for s in STATUSES}

    totals = empty()
    per_team = {t["id"]: {"team": t, "members": 0, **empty()} for t in teams}
    for e in active_emps:
        eid = e["id"]
        tid = team_map.get(eid) or rec_team_map.get(eid) or today_team_map.get(eid)
        if tid in per_team:
            per_team[tid]["members"] += 1

    for record in records:
        employee_id = record.get("employee_id")
        if employee_id not in active_ids:
            continue
        status = str(record.get("status") or "").strip().upper()
        if status not in STATUSES:
            continue
        team_id = record.get("team_id") or team_map.get(employee_id) or today_team_map.get(employee_id)
        totals[status] += 1
        if team_id in per_team:
            per_team[team_id][status] += 1

    # Parallel resolution of kasubid and commanders
    kasubid_keys = [("KASUBID1", "Kasubid 1"), ("KASUBID2", "Kasubid 2")]
    kasubid_tasks = [resolve_kasubid_for_date(pid, ref) for pid, _ in kasubid_keys]
    team_list = list(per_team.values())
    commander_tasks = [resolve_commander_for_date(t["team"]["id"], ref) for t in team_list]
    today_commander_tasks = [resolve_commander_for_date(t["team"]["id"], today_iso) for t in team_list] if ref != today_iso else []

    resolved_ids = await asyncio.gather(*kasubid_tasks, *commander_tasks, *today_commander_tasks)
    kasubid_eids = resolved_ids[:len(kasubid_keys)]
    commander_eids = resolved_ids[len(kasubid_keys):len(kasubid_keys) + len(team_list)]
    today_commander_eids = resolved_ids[len(kasubid_keys) + len(team_list):] if ref != today_iso else commander_eids

    kasubid = []
    for (pid, plabel), eid in zip(kasubid_keys, kasubid_eids):
        nama = emp_names.get(eid)
        if not nama and eid:
            emp = (await db.table("employees").select("nama").eq("id", eid).limit(1).execute()).data
            nama = emp[0]["nama"] if emp else None
        kasubid.append({
            "position_id": pid,
            "label": plabel,
            "employee_id": eid,
            "nama": nama,
            "status": "Aktif" if eid and nama else "Kosong",
        })

    for idx, (t, cid) in enumerate(zip(team_list, commander_eids)):
        today_cid = today_commander_eids[idx]
        effective_cid = cid or today_cid
        cname = emp_names.get(effective_cid)
        if not cname and effective_cid:
            cemp = (await db.table("employees").select("nama").eq("id", effective_cid).limit(1).execute()).data
            cname = cemp[0]["nama"] if cemp else None

        today_cname = emp_names.get(today_cid)
        if not today_cname and today_cid:
            cemp = (await db.table("employees").select("nama").eq("id", today_cid).limit(1).execute()).data
            today_cname = cemp[0]["nama"] if cemp else None

        t["commander_id"] = effective_cid
        t["commander_name"] = cname
        t["current_commander_id"] = today_cid
        t["current_commander_name"] = today_cname

    return {
        "date": ref,
        "today": today_iso,
        "latest_date": latest_date,
        "has_attendance_today": has_attendance_today,
        "is_fallback_to_latest": is_fallback,
        "total_employees": total_employees,
        "totals": totals,
        "per_team": team_list,
        "kasubid": kasubid,
    }


@router.get("/org-structure")
async def org_structure(date: str = None, user: dict = Depends(get_current_user)):
    db = await get_db()
    ref = date or _date.today().isoformat()
    teams = (await db.table("teams").select("*").order("order").limit(100).execute()).data or []
    team_map = await resolve_teams_for_date(ref)
    today_team_map = await resolve_teams_for_date(_date.today().isoformat()) if ref != _date.today().isoformat() else team_map
    emps = {e["id"]: e for e in ((await db.table("employees").select("*").eq("status", "ACTIVE").limit(5000).execute()).data or [])}
    counts = {}
    for eid in emps:
        tid = team_map.get(eid) or today_team_map.get(eid)
        if tid:
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
        if not cid and ref != _date.today().isoformat():
            cid = await resolve_commander_for_date(t["id"], _date.today().isoformat())
        team_out.append({**t, "members_count": counts.get(t["id"], 0),
                         "commander_id": cid, "commander_name": emps.get(cid, {}).get("nama") if cid else None})
    return {"date": ref, "kasubid": kasubid, "teams": team_out}
