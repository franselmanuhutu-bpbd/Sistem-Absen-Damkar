from fastapi import APIRouter, HTTPException, Depends

from database import get_db
from models import LoginIn
from auth import verify_password, create_token, clean, get_current_user

router = APIRouter(tags=["Auth"])


@router.post("/auth/login")
async def login(body: LoginIn):
    db = await get_db()
    email = body.email.lower().strip()
    res = await db.table("users").select("*").eq("email", email).execute()
    user = res.data[0] if res.data else None
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if user.get("status") == "INACTIVE":
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    token = create_token(user)
    return {"access_token": token, "user": clean(user)}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}
