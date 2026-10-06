from fastapi import Request, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

from config import JWT_SECRET, JWT_ALG
from database import get_db


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

    db = await get_db()
    res = await db.table("users").select("*").eq("id", payload["sub"]).execute()
    user = res.data[0] if res.data else None

    if not user or user.get("status") == "INACTIVE":
        raise HTTPException(status_code=401, detail="User tidak ditemukan / nonaktif")
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
