from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from auth import get_current_user, require_roles
from utils import _compute_recap, _compute_kasubid_recap

router = APIRouter(tags=["Recap"])


@router.get("/recap/monthly")
async def recap_monthly(month: str, team_id: str = None, category: str = None, user: dict = Depends(get_current_user)):
    return await _compute_recap(month, month, team_id or None, category or None)


@router.get("/recap/period")
async def recap_period(start: str, end: str, team_id: str = None, category: str = None, user: dict = Depends(get_current_user)):
    if start > end:
        raise HTTPException(status_code=400, detail="Bulan mulai tidak boleh setelah bulan selesai")
    return await _compute_recap(start, end, team_id or None, category or None)


@router.get("/recap/kasubid")
async def recap_kasubid(
    start: str,
    end: str,
    user: dict = Depends(require_roles("admin", "operator", "viewer", "kasubid")),
):
    if start > end:
        raise HTTPException(status_code=400, detail="Periode tidak valid")
    return await _compute_kasubid_recap(start, end)
