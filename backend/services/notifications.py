import os
import json
import uuid
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timezone

from config import (
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_CLAIM_EMAIL,
    logger,
)
from database import get_db

try:
    from pywebpush import webpush, WebPushException
    PYWEBPUSH_AVAILABLE = True
except ImportError:
    PYWEBPUSH_AVAILABLE = False
    logger.warning("[PUSH] pywebpush is not installed. Web Push notifications will be simulated.")

DATA_DIR = Path(__file__).parent.parent / "data"
LOCAL_SUBS_FILE = DATA_DIR / "push_subscriptions.json"


def _ensure_local_store() -> List[Dict[str, Any]]:
    """Ensure local fallback directory and file exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not LOCAL_SUBS_FILE.exists():
        with open(LOCAL_SUBS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
        return []
    try:
        with open(LOCAL_SUBS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_local_sub(sub: Dict[str, Any]):
    subs = _ensure_local_store()
    subs = [s for s in subs if s.get("endpoint") != sub.get("endpoint")]
    subs.append(sub)
    with open(LOCAL_SUBS_FILE, "w", encoding="utf-8") as f:
        json.dump(subs, f, indent=2, default=str)


def _delete_local_sub(endpoint: str):
    subs = _ensure_local_store()
    subs = [s for s in subs if s.get("endpoint") != endpoint]
    with open(LOCAL_SUBS_FILE, "w", encoding="utf-8") as f:
        json.dump(subs, f, indent=2, default=str)


async def save_push_subscription(
    user_id: Optional[str],
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Store or update browser Web Push subscription.
    Attempts Supabase first; if table doesn't exist, seamlessly uses local JSON store.
    """
    now_str = datetime.now(timezone.utc).isoformat()
    sub_id = str(uuid.uuid4())
    sub_data = {
        "id": sub_id,
        "user_id": user_id,
        "endpoint": endpoint,
        "p256dh": p256dh,
        "auth": auth,
        "user_agent": user_agent or "",
        "created_at": now_str,
        "updated_at": now_str,
    }

    saved_to_db = False
    try:
        db = await get_db()
        # Check if subscription with endpoint already exists
        res = await db.table("push_subscriptions").select("id").eq("endpoint", endpoint).execute()
        if res.data:
            existing_id = res.data[0]["id"]
            await db.table("push_subscriptions").update({
                "user_id": user_id,
                "p256dh": p256dh,
                "auth": auth,
                "user_agent": user_agent or "",
                "updated_at": now_str,
            }).eq("id", existing_id).execute()
            sub_data["id"] = existing_id
        else:
            await db.table("push_subscriptions").insert(sub_data).execute()
        saved_to_db = True
        logger.info(f"[PUSH] Subscription saved to Supabase for user {user_id}")
    except Exception as exc:
        logger.warning(f"[PUSH] Notice: Supabase push_subscriptions table not active or error ({exc}). Falling back to local file store.")
        _save_local_sub(sub_data)
        saved_to_db = False

    return sub_data


async def delete_push_subscription(endpoint: str):
    """Remove expired or unsubscribed endpoint."""
    _delete_local_sub(endpoint)
    try:
        db = await get_db()
        await db.table("push_subscriptions").delete().eq("endpoint", endpoint).execute()
    except Exception as exc:
        logger.warning(f"[PUSH] Error deleting subscription from DB: {exc}")


async def get_push_subscriptions(user_id: Optional[str] = None, role: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieve subscriptions filtered by user_id or user role.
    Combines DB and local fallback store without duplicates.
    """
    results: Dict[str, Dict[str, Any]] = {}

    target_user_ids = None
    if role:
        try:
            db = await get_db()
            users_res = await db.table("users").select("id").eq("role", role).eq("status", "ACTIVE").execute()
            target_user_ids = set(u["id"] for u in (users_res.data or []))
        except Exception as exc:
            logger.warning(f"[PUSH] Could not filter users by role {role}: {exc}")

    # 1. Read from Supabase DB
    try:
        db = await get_db()
        query = db.table("push_subscriptions").select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        res = await query.execute()
        for sub in (res.data or []):
            if target_user_ids is not None and sub.get("user_id") not in target_user_ids:
                continue
            results[sub["endpoint"]] = sub
    except Exception:
        pass

    # 2. Read from local store fallback
    local_subs = _ensure_local_store()
    for sub in local_subs:
        if user_id and sub.get("user_id") != user_id:
            continue
        if target_user_ids is not None and sub.get("user_id") not in target_user_ids:
            continue
        if sub.get("endpoint") not in results:
            results[sub.get("endpoint")] = sub

    return list(results.values())


def dispatch_web_push(
    subscription: Dict[str, Any],
    payload: Dict[str, Any],
) -> bool:
    """
    Send low-level Web Push notification using pywebpush.
    """
    if not PYWEBPUSH_AVAILABLE:
        logger.info(f"[PUSH SIMULATION] Push payload to endpoint {subscription.get('endpoint', '')[:30]}: {payload}")
        return True

    if not VAPID_PRIVATE_KEY:
        logger.error("[PUSH] VAPID_PRIVATE_KEY is not configured in .env")
        return False

    sub_info = {
        "endpoint": subscription["endpoint"],
        "keys": {
            "p256dh": subscription["p256dh"],
            "auth": subscription["auth"],
        },
    }

    try:
        webpush(
            subscription_info=sub_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIM_EMAIL},
            ttl=86400,
        )
        logger.info(f"[PUSH] Successfully sent push to endpoint {subscription['endpoint'][:35]}...")
        return True
    except WebPushException as ex:
        code = ex.response.status_code if ex.response is not None else None
        logger.warning(f"[PUSH] WebPushException ({ex}): {code}")
        if code in (401, 404, 410):
            logger.info(f"[PUSH] Pruning invalid/expired subscription ({code}): {subscription['endpoint'][:35]}...")
            _delete_local_sub(subscription["endpoint"])
        return False
    except Exception as err:
        logger.error(f"[PUSH] Unexpected error sending push: {err}")
        return False


async def send_push_notification(
    user_id: Optional[str] = None,
    role: Optional[str] = None,
    title: str = "Pemberitahuan DAMKAR",
    body: str = "",
    url: str = "/laporan",
    tag: str = "damkar-alert",
    icon: str = "/favicon.ico",
    data: Optional[Dict[str, Any]] = None,
) -> Tuple[int, int]:
    """
    Send push notification to all matched subscriptions (by user_id, or by role).
    Returns (delivered_count, total_subscriptions).
    """
    subs = await get_push_subscriptions(user_id=user_id, role=role)
    if not subs:
        logger.info(f"[PUSH] No active push subscriptions found for user_id={user_id}, role={role}")
        return 0, 0

    payload = {
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
        "icon": icon,
        "data": data or {"url": url},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    delivered = 0
    for sub in subs:
        success = dispatch_web_push(sub, payload)
        if success:
            delivered += 1

    return delivered, len(subs)


async def get_database_backup_status(threshold_days: int = 7) -> Dict[str, Any]:
    """
    Calculate database backup status based on latest audit log.
    """
    db = await get_db()
    last_backup_time = None
    days_since_backup = None

    try:
        res = (
            await db.table("audit_logs")
            .select("timestamp, user_name, user_email")
            .eq("action", "Backup database")
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            last_backup_time = res.data[0]["timestamp"]
            # Parse timestamp
            cleaned = last_backup_time.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            now = datetime.now(timezone.utc)
            delta = now - dt
            days_since_backup = max(0, delta.days)
    except Exception as exc:
        logger.warning(f"[PUSH] Error checking backup status: {exc}")

    is_due = (days_since_backup is None) or (days_since_backup >= threshold_days)
    admin_subs = await get_push_subscriptions(role="admin")

    return {
        "last_backup_time": last_backup_time,
        "days_since_backup": days_since_backup,
        "is_backup_due": is_due,
        "threshold_days": threshold_days,
        "admin_subscribers_count": len(admin_subs),
    }


async def send_database_backup_reminder(force: bool = False, threshold_days: int = 7) -> Dict[str, Any]:
    """
    Send Web Push reminder to all Admin devices if backup is due (or if force=True).
    """
    status = await get_database_backup_status(threshold_days=threshold_days)
    
    if not status["is_backup_due"] and not force:
        return {
            "status": "skipped",
            "message": f"Backup masih aman ({status['days_since_backup']} hari yang lalu, batas {threshold_days} hari).",
            "delivered": 0,
            "total_admin_subscribers": status["admin_subscribers_count"],
            "backup_status": status,
        }

    days = status["days_since_backup"]
    if days is None:
        title = "⚠️ Pengingat: Backup Database DAMKAR Diperlukan"
        body = "Database DAMKAR Mimika belum tercatat pernah dibackup. Silakan lakukan backup data sekarang."
    else:
        title = "⚠️ Pengingat Backup Database DAMKAR"
        body = f"Sudah {days} hari sejak backup terakhir. Amankan data absensi dan pegawai DAMKAR Mimika sekarang."

    delivered, total = await send_push_notification(
        role="admin",
        title=title,
        body=body,
        url="/laporan",
        tag="db-backup-reminder",
        data={"action": "backup", "url": "/laporan"},
    )

    return {
        "status": "success" if delivered > 0 else ("no_subscribers" if total == 0 else "delivery_failed"),
        "message": f"Pengingat backup terkirim ke {delivered} dari {total} perangkat admin.",
        "delivered": delivered,
        "total_admin_subscribers": total,
        "backup_status": status,
    }
