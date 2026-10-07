from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel

from config import VAPID_PUBLIC_KEY, logger
from auth import get_current_user, require_roles
from utils import write_audit
from services.notifications import (
    save_push_subscription,
    delete_push_subscription,
    send_push_notification,
    get_database_backup_status,
    send_database_backup_reminder,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionPayload(BaseModel):
    endpoint: str
    keys: SubscriptionKeys
    user_agent: Optional[str] = None


class TestNotificationPayload(BaseModel):
    title: Optional[str] = "🔔 Tes Web Push DAMKAR"
    body: Optional[str] = "Sistem Web Push notifikasi DAMKAR Mimika berhasil terhubung!"
    url: Optional[str] = "/laporan"


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Returns the VAPID applicationServerKey for browser push subscription."""
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe_push(
    payload: PushSubscriptionPayload,
    user: dict = Depends(get_current_user),
):
    """Register or refresh a browser Web Push subscription for the authenticated user."""
    try:
        result = await save_push_subscription(
            user_id=user.get("id"),
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=payload.user_agent,
        )
        return {
            "status": "subscribed",
            "subscription": {
                "id": result.get("id"),
                "user_id": result.get("user_id"),
                "endpoint": result.get("endpoint"),
            },
        }
    except Exception as e:
        logger.error(f"[PUSH] Failed to save subscription: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan subscription push: {e}")


@router.post("/unsubscribe")
async def unsubscribe_push(
    payload: Dict[str, str] = Body(...),
    user: dict = Depends(get_current_user),
):
    """Remove browser Web Push subscription."""
    endpoint = payload.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Endpoint wajib disertakan")
    await delete_push_subscription(endpoint, user_id=user.get("id"))
    return {"status": "unsubscribed"}


@router.get("/backup-status")
async def backup_status(
    threshold_days: int = 7,
    user: dict = Depends(require_roles("admin")),
):
    """Check database backup age and whether a reminder is due."""
    status = await get_database_backup_status(threshold_days=threshold_days)
    return status


@router.post("/backup-reminder")
async def trigger_backup_reminder(
    force: bool = True,
    threshold_days: int = 7,
    user: dict = Depends(require_roles("admin")),
):
    """
    Trigger database backup reminder notification to all registered Admin devices.
    """
    result = await send_database_backup_reminder(force=force, threshold_days=threshold_days)
    await write_audit(
        user,
        "Mengirim pengingat backup database via Web Push",
        detail=f"Terkirim ke {result.get('delivered', 0)} perangkat",
    )
    return result


@router.post("/test")
async def test_push_notification(
    payload: Optional[TestNotificationPayload] = None,
    user: dict = Depends(get_current_user),
):
    """Send an immediate test push notification to the logged-in user's device."""
    title = payload.title if payload and payload.title else "🔔 Tes Web Push DAMKAR"
    body = payload.body if payload and payload.body else "Sistem Web Push notifikasi DAMKAR Mimika aktif dan berjalan dengan baik."
    url = payload.url if payload and payload.url else "/laporan"

    delivered, total = await send_push_notification(
        user_id=user.get("id"),
        title=title,
        body=body,
        url=url,
        tag="test-notification",
    )

    if total == 0:
        return {
            "status": "warning",
            "message": "Perangkat ini belum terdaftar untuk Web Push. Silakan aktifkan izin notifikasi di browser.",
            "delivered": 0,
            "total": 0,
        }

    if delivered == 0:
        return {
            "status": "error",
            "message": f"Ditemukan {total} subscription, namun pengiriman gagal. Silakan klik Aktifkan ulang notifikasi.",
            "delivered": 0,
            "total": total,
        }

    return {
        "status": "success",
        "message": f"Notifikasi berhasil dikirim ke {delivered} perangkat aktif.",
        "delivered": delivered,
        "total": total,
    }
