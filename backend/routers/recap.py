import re
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from auth import get_current_user, require_roles
from utils import _compute_recap, _compute_kasubid_recap

router = APIRouter(tags=["Recap"])

MONTH_REGEX = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


@router.get("/recap/monthly")
async def recap_monthly(month: str, team_id: str = None, category: str = None, user: dict = Depends(get_current_user)):
    if not MONTH_REGEX.match(month or ""):
        raise HTTPException(status_code=400, detail="Format bulan tidak valid. Gunakan format YYYY-MM.")
    return await _compute_recap(month, month, team_id or None, category or None)


@router.get("/recap/period")
async def recap_period(start: str, end: str, team_id: str = None, category: str = None, user: dict = Depends(get_current_user)):
    if not MONTH_REGEX.match(start or "") or not MONTH_REGEX.match(end or ""):
        raise HTTPException(status_code=400, detail="Format bulan mulai dan selesai harus YYYY-MM.")
    if start > end:
        raise HTTPException(status_code=400, detail="Bulan mulai tidak boleh setelah bulan selesai")
    return await _compute_recap(start, end, team_id or None, category or None)


@router.get("/recap/kasubid")
async def recap_kasubid(
    start: str,
    end: str,
    user: dict = Depends(require_roles("admin", "operator", "viewer", "kasubid")),
):
    if not MONTH_REGEX.match(start or "") or not MONTH_REGEX.match(end or ""):
        raise HTTPException(status_code=400, detail="Format bulan mulai dan selesai harus YYYY-MM.")
    if start > end:
        raise HTTPException(status_code=400, detail="Periode tidak valid")
    return await _compute_kasubid_recap(start, end)
