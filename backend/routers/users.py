from fastapi import APIRouter, HTTPException, Depends
import uuid

from config import ALLOWED_ROLES
from database import get_db
from models import UserIn
from auth import require_roles, hash_password, clean
from utils import now_iso, write_audit

router = APIRouter(tags=["Users"])


@router.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    db = await get_db()
    res = await db.table("users").select("id, name, email, role, status, employee_id, created_at").limit(1000).execute()
    return res.data or []


@router.post("/users")
async def create_user(body: UserIn, user: dict = Depends(require_roles("admin"))):
    db = await get_db()
    email = body.email.lower().strip()
    existing = (await db.table("users").select("id").eq("email", email).execute()).data
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    if not body.password:
        raise HTTPException(status_code=400, detail="Password wajib diisi")
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Role tidak valid")
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": email,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "status": "ACTIVE",
        "employee_id": body.employee_id or None,
        "created_at": now_iso(),
    }
    await db.table("users").insert(doc).execute()
    await write_audit(user, "Membuat user baru", detail=f"{body.name} ({body.role})")
    return clean(doc)


@router.put("/users/{uid}")
async def update_user(uid: str, body: UserIn, user: dict = Depends(require_roles("admin"))):
    db = await get_db()
    existing = (await db.table("users").select("id").eq("id", uid).execute()).data
    if not existing:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    update = {
        "name": body.name,
        "role": body.role,
        "status": body.status,
        "email": body.email.lower().strip(),
        "employee_id": body.employee_id or None,
    }
    if body.password:
        update["password_hash"] = hash_password(body.password)
    await db.table("users").update(update).eq("id", uid).execute()
    await write_audit(user, "Mengubah user", detail=body.name)
    return {"ok": True}


@router.delete("/users/{uid}")
async def deactivate_user(uid: str, user: dict = Depends(require_roles("admin"))):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menonaktifkan akun sendiri")
    db = await get_db()
    await db.table("users").update({"status": "INACTIVE"}).eq("id", uid).execute()
    await write_audit(user, "Menonaktifkan user")
    return {"ok": True}
