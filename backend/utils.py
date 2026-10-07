import calendar as _cal
from datetime import datetime, timezone, timedelta, date as _date
from typing import List, Optional, Dict, Any
import uuid

from config import STATUSES, KASUBID_POSITIONS, logger
from database import get_db, fetch_all


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def last_day_of_month(year: int, month: int) -> int:
    return _cal.monthrange(year, month)[1]


def month_range(start: str, end: str) -> List[str]:
    """Return list of 'YYYY-MM' from start to end inclusive."""
    sy, sm = int(start[:4]), int(start[5:7])
    ey, em = int(end[:4]), int(end[5:7])
    out = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out


def _month_label(m: str) -> str:
    names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
             "Agustus", "September", "Oktober", "November", "Desember"]
    return f"{names[int(m[5:7]) - 1]} {m[:4]}"


def _period_label(start: str, end: str) -> str:
    if start == end:
        return _month_label(start)
    return f"{_month_label(start)} \u2013 {_month_label(end)}"


async def write_audit(user: dict, action: str, **extra):
    db = await get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "timestamp": now_iso(),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "action": action,
    }
    doc.update(extra)
    try:
        await db.table("audit_logs").insert(doc).execute()
    except Exception as e:
        logger.warning(f"Failed to write audit log: {e}")


async def resolve_teams_for_date(date_str: str) -> dict:
    """Return {employee_id: team_id} active on a given date (YYYY-MM-DD)."""
    db = await get_db()
    res = await db.table("team_assignments").select("*").lte("start_date", date_str).execute()
    assignments = res.data or []
    result = {}
    for a in assignments:
        end = a.get("end_date")
        if end and end < date_str:
            continue
        prev = result.get(a["employee_id"])
        if prev is None or a["start_date"] > prev[1]:
            result[a["employee_id"]] = (a["team_id"], a["start_date"])
    return {k: v[0] for k, v in result.items()}


async def build_intervals() -> dict:
    db = await get_db()
    res = await db.table("team_assignments").select("*").limit(50000).execute()
    all_a = res.data or []
    by_emp = {}
    for a in all_a:
        by_emp.setdefault(a["employee_id"], []).append(a)
    return by_emp


def resolve_team_at(by_emp: dict, eid: str, date: str) -> Optional[str]:
    best = None
    for a in by_emp.get(eid, []):
        if a["start_date"] <= date and (not a.get("end_date") or a["end_date"] >= date):
            if best is None or a["start_date"] > best["start_date"]:
                best = a
    return best["team_id"] if best else None


async def resolve_commander_for_date(team_id: str, date: str) -> Optional[str]:
    db = await get_db()
    res = await db.table("team_commanders").select("*").eq("team_id", team_id).lte("start_date", date).execute()
    best = None
    for a in (res.data or []):
        if a.get("end_date") and a["end_date"] < date:
            continue
        if best is None or a["start_date"] > best["start_date"]:
            best = a
    return best["employee_id"] if best else None


async def resolve_kasubid_for_date(position_id: str, date: str) -> Optional[str]:
    db = await get_db()
    res = await db.table("sub_unit_assignments").select("*").eq("position_id", position_id).lte("start_date", date).execute()
    best = None
    for a in (res.data or []):
        if a.get("end_date") and a["end_date"] < date:
            continue
        if best is None or a["start_date"] > best["start_date"]:
            best = a
    return best["employee_id"] if best else None


async def _compute_recap(start_month: str, end_month: str, team_id: Optional[str], category: Optional[str] = None):
    """HISTORICAL recap: regu pegawai ditentukan per TANGGAL absensi (bukan posisi terkini)."""
    db = await get_db()
    months = month_range(start_month, end_month)
    start_date = f"{start_month}-01"
    ey, em = int(end_month[:4]), int(end_month[5:7])
    end_date = f"{end_month}-{last_day_of_month(ey, em):02d}"

    by_emp = await build_intervals()
    teams = {t["id"]: t for t in ((await db.table("teams").select("*").execute()).data or [])}
    employees = (await db.table("employees").select("*").order("no").execute()).data or []

    today_str = now_iso()[:10]
    kasubid_ids = set()
    positions = (await db.table("sub_unit_assignments").select("position_id").execute()).data or []
    for pid in set(p["position_id"] for p in positions):
        eid = await resolve_kasubid_for_date(pid, today_str)
        if eid:
            kasubid_ids.add(eid)

    employees.sort(key=lambda e: (e["id"] not in kasubid_ids, e["no"]))

    att_q = db.table("attendance").select("employee_id, date, status").gte("date", start_date).lte("date", end_date)
    records = await fetch_all(att_q)

    emp_status = {}
    emp_team_first = {}
    mt = {}
    present = set()

    for r in records:
        st = r["status"]
        if st not in STATUSES:
            continue
        eid = r["employee_id"]
        d = r["date"]
        tid = resolve_team_at(by_emp, eid, d)
        if team_id and tid != team_id:
            continue
        present.add(eid)
        emp_status.setdefault(eid, {s: 0 for s in STATUSES})[st] += 1
        k = (eid, tid)
        if k not in emp_team_first or d < emp_team_first[k]:
            emp_team_first[k] = d
        mk = (eid, tid, d[:7])
        mt.setdefault(mk, {s: 0 for s in STATUSES})[st] += 1

    rows = []
    breakdown = []
    grand = {s: 0 for s in STATUSES}
    total_days_month = sum(last_day_of_month(int(m[:4]), int(m[5:7])) for m in months)

    for e in employees:
        eid = e["id"]
        cat = "Kasubid" if eid in kasubid_ids else "Staff"
        if category in ("Staff", "Kasubid") and cat != category:
            continue
        if team_id and eid not in present:
            continue
        if not team_id and e.get("status") == "INACTIVE" and eid not in present:
            continue
        counts = emp_status.get(eid, {s: 0 for s in STATUSES})
        total = sum(counts.values())
        seen = sorted([(k[1], emp_team_first[k]) for k in emp_team_first if k[0] == eid], key=lambda x: (x[1] or "", x[0] or ""))
        team_ids_ordered = [t for t, _ in seen]
        if team_ids_ordered:
            regu_label = " \u2192 ".join(teams.get(t, {}).get("name", "-") for t in team_ids_ordered)
        else:
            tid_now = resolve_team_at(by_emp, eid, end_date)
            regu_label = teams.get(tid_now, {}).get("name", "-") if tid_now else "-"
        for s in STATUSES:
            grand[s] += counts[s]
        emp_jhk = max(0, total_days_month - counts.get("OFF", 0))
        rows.append({
            "employee_id": eid, "no": e["no"], "nip": e["nip"], "nama": e["nama"],
            "jabatan": e["jabatan"], "pangkat": e["pangkat"], "category": cat,
            "team_ids": team_ids_ordered, "regu": regu_label,
            **counts, "total": total, "jumlah_hari_kerja": emp_jhk,
            "total_kehadiran": counts["HDR"],
        })
        emp_breaks = sorted([(k, v) for k, v in mt.items() if k[0] == eid], key=lambda kv: (kv[0][2], kv[0][1] or ""))
        for (ee, tid, mo), cc in emp_breaks:
            mo_days = last_day_of_month(int(mo[:4]), int(mo[5:7]))
            mo_jhk = max(0, mo_days - cc.get("OFF", 0))
            breakdown.append({
                "employee_id": eid, "no": e["no"], "nip": e["nip"], "nama": e["nama"],
                "team_id": tid, "regu": teams.get(tid, {}).get("name", "-"), "category": cat,
                "month": mo, "month_label": _month_label(mo),
                **cc, "total": sum(cc.values()),
                "jumlah_hari_kerja": mo_jhk,
                "total_kehadiran": cc["HDR"],
            })
    return {
        "months": months, "rows": rows, "breakdown": breakdown, "grand_total": grand,
        "total_pegawai": len(rows),
        "period_label": _period_label(start_month, end_month),
        "jumlah_hari_kerja": total_days_month,
    }


async def _compute_kasubid_recap(start_month: str, end_month: str):
    db = await get_db()
    months = month_range(start_month, end_month)
    total_days_month = sum(last_day_of_month(int(m[:4]), int(m[5:7])) for m in months)
    sd = f"{start_month}-01"
    ey, em = int(end_month[:4]), int(end_month[5:7])
    ed = f"{end_month}-{last_day_of_month(ey, em):02d}"
    subs_res = await db.table("sub_unit_assignments").select("*").execute()
    all_subs = subs_res.data or []
    kasubid_eids = list(set(a["employee_id"] for a in all_subs if a.get("employee_id")))

    if kasubid_eids:
        records = await fetch_all(db.table("attendance").select("*").in_("employee_id", kasubid_eids).gte("date", sd).lte("date", ed))
    else:
        records = []

    att = {(r["employee_id"], r["date"]): r["status"] for r in records}
    emps = {e["id"]: e for e in ((await db.table("employees").select("*").execute()).data or [])}

    def resolve_kasubid_mem(pid, date_str):
        best = None
        for a in all_subs:
            if a["position_id"] == pid and a["start_date"] <= date_str:
                if a.get("end_date") and a["end_date"] < date_str:
                    continue
                if best is None or a["start_date"] > best["start_date"]:
                    best = a
        return best["employee_id"] if best else None

    positions = []
    detail = []

    for pid, label in KASUBID_POSITIONS:
        counts = {s: 0 for s in STATUSES}
        monthly = {m: {s: 0 for s in STATUSES} for m in months}
        holders = []
        d = _date.fromisoformat(sd)
        end_d = _date.fromisoformat(ed)
        
        while d <= end_d:
            ds = d.isoformat()
            eid = resolve_kasubid_mem(pid, ds)
            if eid:
                nm = emps.get(eid, {}).get("nama")
                if nm and nm not in holders:
                    holders.append(nm)
                st = att.get((eid, ds))
                if st in STATUSES:
                    counts[st] += 1
                    monthly[ds[:7]][st] += 1
                    detail.append({"date": ds, "position_id": pid, "label": label,
                                   "nama": nm, "status": st})
            d += timedelta(days=1)

        pos_jhk = max(0, total_days_month - counts.get("OFF", 0))
        positions.append({
            "position_id": pid, "label": label, "holders": holders,
            "nama": " / ".join(holders) if holders else "-",
            **counts,
            "jumlah_hari_kerja": pos_jhk,
            "total_kehadiran": counts["HDR"],
            "total": sum(counts.values()),
            "monthly": [{
                "month": m, "month_label": _month_label(m), **monthly[m],
                "jumlah_hari_kerja": max(0, last_day_of_month(int(m[:4]), int(m[5:7])) - monthly[m].get("OFF", 0)),
                "total_kehadiran": monthly[m]["HDR"],
                "total": sum(monthly[m].values()),
            } for m in months],
        })

    detail.sort(key=lambda x: (x["position_id"], x["date"]), reverse=True)
    return {
        "months": months, "positions": positions, "detail": detail,
        "period_label": _period_label(start_month, end_month),
        "jumlah_hari_kerja": total_days_month,
    }
