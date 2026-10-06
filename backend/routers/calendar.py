from fastapi import APIRouter, Depends
from typing import Optional

from config import STATUSES
from database import get_db, fetch_all
from auth import get_current_user
from utils import last_day_of_month

router = APIRouter(tags=["Calendar"])


@router.get("/calendar")
async def calendar_view(month: str, team_id: str = None, user: dict = Depends(get_current_user)):
    db = await get_db()
    y, m = int(month[:4]), int(month[5:7])
    ld = last_day_of_month(y, m)
    start_date = f"{month}-01"
    end_date = f"{month}-{ld:02d}"

    q = db.table("attendance").select("*").gte("date", start_date).lte("date", end_date)
    if team_id:
        q = q.eq("team_id", team_id)
    records = await fetch_all(q)

    days = {f"{month}-{d:02d}": {s: 0 for s in STATUSES} for d in range(1, ld + 1)}
    for r in records:
        if r["date"] in days and r["status"] in STATUSES:
            days[r["date"]][r["status"]] += 1
    return {"month": month, "days": days}
