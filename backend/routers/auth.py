from collections import defaultdict
import time
from fastapi import APIRouter, HTTPException, Depends, Request

from database import get_db
from models import LoginIn, ChangePasswordIn
from auth import verify_password, create_token, clean, get_current_user, hash_password, invalidate_user_cache
from utils import write_audit

router = APIRouter(tags=["Auth"])

# In-memory sliding window rate limiter for login attempts
_LOGIN_ATTEMPTS = defaultdict(list)
MAX_LOGIN_ATTEMPTS = 5
WINDOW_SECONDS = 60


def check_rate_limit(request: Request) -> str:
    client_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    now = time.time()
    _LOGIN_ATTEMPTS[client_ip] = [t for t in _LOGIN_ATTEMPTS[client_ip] if now - t < WINDOW_SECONDS]
    if len(_LOGIN_ATTEMPTS[client_ip]) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Terlalu banyak percobaan login gagal. Mohon tunggu 1 menit sebelum mencoba lagi.",
        )
    return client_ip


def record_failed_attempt(client_ip: str):
    _LOGIN_ATTEMPTS[client_ip].append(time.time())


def reset_attempts(client_ip: str):
    _LOGIN_ATTEMPTS.pop(client_ip, None)


@router.post("/auth/login")
async def login(request: Request, body: LoginIn):
    client_ip = check_rate_limit(request)
    db = await get_db()
    email = body.email.lower().strip()
    res = await db.table("users").select("*").eq("email", email).execute()
    user = res.data[0] if res.data else None
    if not user or not verify_password(body.password, user["password_hash"]):
        record_failed_attempt(client_ip)
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if user.get("status") == "INACTIVE":
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    reset_attempts(client_ip)
    token = create_token(user)
    return {"access_token": token, "user": clean(user)}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


@router.put("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    db = await get_db()
    res = await db.table("users").select("*").eq("id", user["id"]).execute()
    db_user = res.data[0] if res.data else None
    if not db_user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    if not verify_password(body.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama tidak sesuai")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")

    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="Password baru tidak boleh sama dengan password lama")

    new_hash = hash_password(body.new_password)
    await db.table("users").update({"password_hash": new_hash}).eq("id", user["id"]).execute()
    invalidate_user_cache(user["id"])
    await write_audit(user, "Ubah password mandiri", detail=f"Email: {user.get('email')}")
    return {"ok": True, "message": "Password berhasil diperbarui"}

