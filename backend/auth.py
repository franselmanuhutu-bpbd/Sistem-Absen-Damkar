from fastapi import Request, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

from config import JWT_SECRET, JWT_ALG, logger
from database import get_db, reset_db_client
import time
import asyncio
import httpx
import httpcore

# In-memory user cache with TTL (seconds) to prevent redundant queries and withstand transient network drops
_USER_CACHE: dict = {}
USER_CACHE_TTL = 60


def invalidate_user_cache(user_id: str = None):
    """Invalidate cached user profile(s)."""
    global _USER_CACHE
    if user_id:
        _USER_CACHE.pop(user_id, None)
    else:
        _USER_CACHE.clear()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user: dict) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be configured in environment variables (.env)")
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def clean(doc: dict) -> dict:
    if doc:
        doc = dict(doc)
        doc.pop("_id", None)
        doc.pop("password_hash", None)
    return doc


async def get_current_user(request: Request) -> dict:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be configured in environment variables (.env)")
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

    user_id = payload["sub"]
    cached_entry = _USER_CACHE.get(user_id)
    now = time.monotonic()
    if cached_entry and (now - cached_entry[0] < USER_CACHE_TTL):
        return clean(cached_entry[1])

    user = None
    last_err = None
    for attempt in range(2):
        try:
            db = await get_db()
            res = await db.table("users").select("*").eq("id", user_id).execute()
            user = res.data[0] if res.data else None
            break
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.NetworkError, httpcore.ConnectError, httpcore.ConnectTimeout) as err:
            last_err = err
            logger.warning(f"Database network glitch while authenticating user {user_id}: {err}. Resetting connection...")
            await reset_db_client()
            if attempt == 0:
                await asyncio.sleep(0.3)

    if user is None and last_err is not None:
        if cached_entry:
            logger.info(f"Using stale cached profile for user {user_id} due to database unreachable.")
            return clean(cached_entry[1])
        raise HTTPException(
            status_code=503,
            detail="Koneksi ke database sedang terganggu. Silakan coba beberapa saat lagi.",
        )

    if not user or user.get("status") == "INACTIVE":
        raise HTTPException(status_code=401, detail="User tidak ditemukan / nonaktif")

    _USER_CACHE[user_id] = (now, user)
    return clean(user)


def require_roles(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses untuk tindakan ini")
        return user
    return dep


async def _require_employee(user: dict) -> str:
    eid = user.get("employee_id")
    if not eid:
        raise HTTPException(status_code=400, detail="Akun Anda belum tertaut ke data pegawai. Hubungi Admin.")
    return eid
