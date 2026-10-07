from fastapi import APIRouter, HTTPException, Depends
from datetime import date as _date

from config import STATUSES, KASUBID_POSITIONS
from database import get_db
from auth import get_current_user, _require_employee
from utils import (
    last_day_of_month, _period_label, build_intervals,
    resolve_team_at, resolve_teams_for_date,
    resolve_commander_for_date, resolve_kasubid_for_date
)

router = APIRouter(tags=["Me"])


@router.get("/me/profile")
async def my_profile(user: dict = Depends(get_current_user)):
    eid = await _require_employee(user)
    db = await get_db()
    emp_res = await db.table("employees").select("*").eq("id", eid).execute()
    if not emp_res.data:
        raise HTTPException(status_code=404, detail="Data pegawai tidak ditemukan")
    emp = emp_res.data[0]
    today = _date.today().isoformat()
    tid = (await resolve_teams_for_date(today)).get(eid)
    team = (await db.table("teams").select("*").eq("id", tid).execute()).data if tid else None
    team_obj = team[0] if team else None
    cid = await resolve_commander_for_date(tid, today) if tid else None
    cemp = (await db.table("employees").select("*").eq("id", cid).execute()).data if cid else None
    cemp_obj = cemp[0] if cemp else None
    kasubid_pos = None
    for pid, label in KASUBID_POSITIONS:
        if await resolve_kasubid_for_date(pid, today) == eid:
            kasubid_pos = label
    return {
        "employee": emp, "team": team_obj, "commander": cemp_obj["nama"] if cemp_obj else None,
        "is_commander": cid == eid, "kasubid_position": kasubid_pos,
    }


import re

MONTH_REGEX = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


@router.get("/me/recap")
async def my_recap(start: str, end: str, user: dict = Depends(get_current_user)):
    if not MONTH_REGEX.match(start or "") or not MONTH_REGEX.match(end or ""):
        raise HTTPException(status_code=400, detail="Format bulan mulai dan selesai harus YYYY-MM.")
    eid = await _require_employee(user)
    db = await get_db()
    ey, em = int(end[:4]), int(end[5:7])
    sd, ed = f"{start}-01", f"{end}-{last_day_of_month(ey, em):02d}"
    records = (await db.table("attendance").select("*").eq("employee_id", eid).gte("date", sd).lte("date", ed).order("date").limit(5000).execute()).data or []
    teams = {t["id"]: t for t in ((await db.table("teams").select("*").execute()).data or [])}
    by_emp = await build_intervals()
    counts = {s: 0 for s in STATUSES}
    dates = {s: [] for s in STATUSES}
    for r in records:
        st = r["status"]
        if st in STATUSES:
            counts[st] += 1
            tid = resolve_team_at(by_emp, eid, r["date"])
            dates[st].append({"date": r["date"], "regu": teams.get(tid, {}).get("name", "-")})
    return {
        "counts": counts, "dates": dates, "total": sum(counts.values()),
        "period_label": _period_label(start, end),
    }


@router.get("/me/calendar")
async def my_calendar(month: str, user: dict = Depends(get_current_user)):
    if not MONTH_REGEX.match(month or ""):
        raise HTTPException(status_code=400, detail="Format bulan tidak valid. Gunakan format YYYY-MM.")
    eid = await _require_employee(user)
    db = await get_db()
    y, m = int(month[:4]), int(month[5:7])
    ld = last_day_of_month(y, m)
    records = (await db.table("attendance").select("*").eq("employee_id", eid).gte("date", f"{month}-01").lte("date", f"{month}-{ld:02d}").limit(100).execute()).data or []
    teams = {t["id"]: t for t in ((await db.table("teams").select("*").execute()).data or [])}
    by_emp = await build_intervals()
    days = {}
    for r in records:
        tid = resolve_team_at(by_emp, eid, r["date"])
        days[r["date"]] = {"status": r["status"], "regu": teams.get(tid, {}).get("name", "-")}
    return {"month": month, "days": days}


@router.get("/me/assignments")
async def my_assignments(user: dict = Depends(get_current_user)):
    eid = await _require_employee(user)
    db = await get_db()
    assigns = (await db.table("team_assignments").select("*").eq("employee_id", eid).order("start_date", desc=True).limit(500).execute()).data or []
    teams = {t["id"]: t for t in ((await db.table("teams").select("*").execute()).data or [])}
    for a in assigns:
        a["team_name"] = teams.get(a["team_id"], {}).get("name")
    return assigns
