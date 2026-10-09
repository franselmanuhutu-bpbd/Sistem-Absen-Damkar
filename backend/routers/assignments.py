from fastapi import APIRouter, HTTPException, Depends
from datetime import date as _date, timedelta
from typing import Optional, List, Dict, Any
import uuid

from database import get_db
from models import AssignmentIn, BatchAssignmentIn, ResetAssignmentsIn
from auth import get_current_user, require_roles, clean
from utils import now_iso, write_audit, get_active_kasubid_ids

router = APIRouter(tags=["Assignments"])


def _prev_day(date_str: str) -> str:
    """Mengembalikan 1 hari sebelum tanggal yang diberikan (format YYYY-MM-DD)."""
    return (_date.fromisoformat(date_str) - timedelta(days=1)).isoformat()


def _next_day(date_str: str) -> str:
    """Mengembalikan 1 hari setelah tanggal yang diberikan (format YYYY-MM-DD)."""
    return (_date.fromisoformat(date_str) + timedelta(days=1)).isoformat()


async def apply_interval_assignment(
    db: Any,
    employee_id: str,
    team_id: str,
    start_date: str,
    end_date: Optional[str] = None
) -> dict:
    """
    Algoritma Penataan Interval Temporal:
    Menempatkan pegawai ke regu tujuan untuk rentang waktu [start_date, end_date].
    Jika ada penempatan sebelumnya yang bersinggungan, interval lama akan otomatis
    dipotong, dibelah, atau dihapus secara matematis tanpa error tabrakan (overlap collision).
    Kolom team_id pada tabel attendance untuk tanggal terkait juga otomatis diselaraskan.
    """
    new_start = start_date
    new_end_cap = end_date or "9999-12-31"

    # 1. Ambil seluruh riwayat penempatan pegawai yang bersangkutan
    existing_res = await db.table("team_assignments").select("*").eq("employee_id", employee_id).execute()
    existing = existing_res.data or []

    # 2. Proses pemotongan interval untuk setiap penempatan yang bersinggungan
    for a in existing:
        a_start = a["start_date"]
        a_end = a.get("end_date") or "9999-12-31"

        # Cek apakah interval a bersinggungan dengan rentang baru [new_start, new_end_cap]
        is_overlapping = (a_start <= new_end_cap) and (a_end >= new_start)
        if not is_overlapping:
            continue

        # KASUS 1: Penempatan lama tertutup penuh oleh rentang baru -> Hapus penempatan lama
        if new_start <= a_start and new_end_cap >= a_end:
            await db.table("team_assignments").delete().eq("id", a["id"]).execute()

        # KASUS 2: Rentang baru berada di tengah-tengah penempatan lama -> Belah interval menjadi 2
        # (Bagian kiri sebelum new_start, dan bagian kanan setelah new_end_cap)
        elif a_start < new_start and a_end > new_end_cap:
            # Update bagian kiri
            await db.table("team_assignments").update({
                "end_date": _prev_day(new_start),
                "updated_at": now_iso()
            }).eq("id", a["id"]).execute()

            # Buat baris baru untuk bagian kanan
            right_piece = {
                "id": str(uuid.uuid4()),
                "employee_id": employee_id,
                "team_id": a["team_id"],
                "start_date": _next_day(new_end_cap),
                "end_date": a.get("end_date"),
                "created_at": now_iso(),
                "updated_at": now_iso()
            }
            await db.table("team_assignments").insert(right_piece).execute()

        # KASUS 3: Penempatan lama beririsan di sebelah kiri -> Potong batas akhir menjadi sehari sebelum new_start
        elif a_start < new_start <= a_end <= new_end_cap:
            await db.table("team_assignments").update({
                "end_date": _prev_day(new_start),
                "updated_at": now_iso()
            }).eq("id", a["id"]).execute()

        # KASUS 4: Penempatan lama beririsan di sebelah kanan -> Potong batas mulai menjadi sehari setelah new_end_cap
        elif new_start <= a_start <= new_end_cap < a_end:
            await db.table("team_assignments").update({
                "start_date": _next_day(new_end_cap),
                "updated_at": now_iso()
            }).eq("id", a["id"]).execute()

    # 3. Masukkan penempatan baru
    doc = {
        "id": str(uuid.uuid4()),
        "employee_id": employee_id,
        "team_id": team_id,
        "start_date": start_date,
        "end_date": end_date,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.table("team_assignments").insert(doc).execute()

    # 4. Sinkronisasi tabel attendance:
    # Update kolom team_id di data absensi pegawai untuk rentang tanggal tersebut
    try:
        att_query = db.table("attendance").update({
            "team_id": team_id,
            "updated_at": now_iso()
        }).eq("employee_id", employee_id).gte("date", new_start)
        if end_date:
            att_query = att_query.lte("date", end_date)
        await att_query.execute()
    except Exception:
        # Jika update absensi gagal karena tabel belum terhubung, abaikan
        pass

    return doc


async def slice_out_interval_for_assignments(
    db: Any,
    start_date: str,
    end_date: str,
    team_id: Optional[str] = None
) -> int:
    """
    Mengeluarkan/memotong rentang waktu [start_date, end_date] dari penempatan regu yang ada.
    Digunakan untuk reset tanggal tunggal atau reset rentang tanggal.
    """
    # 1. Ambil data penempatan yang bersinggungan dengan rentang reset
    q = db.table("team_assignments").select("*").lte("start_date", end_date)
    if team_id:
        q = q.eq("team_id", team_id)
    res = await q.execute()
    assignments = res.data or []

    affected_count = 0
    for a in assignments:
        a_start = a["start_date"]
        a_end = a.get("end_date") or "9999-12-31"

        # Cek apakah interval bersinggungan
        if not (a_start <= end_date and a_end >= start_date):
            continue

        affected_count += 1

        # KASUS 1: Tertutup penuh oleh rentang reset -> Hapus penempatan
        if start_date <= a_start and end_date >= a_end:
            await db.table("team_assignments").delete().eq("id", a["id"]).execute()

        # KASUS 2: Rentang reset berada di tengah-tengah -> Belah menjadi sebelum dan sesudah
        elif a_start < start_date and a_end > end_date:
            # Bagian sebelum rentang reset
            await db.table("team_assignments").update({
                "end_date": _prev_day(start_date),
                "updated_at": now_iso()
            }).eq("id", a["id"]).execute()

            # Bagian setelah rentang reset
            right_piece = {
                "id": str(uuid.uuid4()),
                "employee_id": a["employee_id"],
                "team_id": a["team_id"],
                "start_date": _next_day(end_date),
                "end_date": a.get("end_date"),
                "created_at": now_iso(),
                "updated_at": now_iso()
            }
            await db.table("team_assignments").insert(right_piece).execute()

        # KASUS 3: Bersinggungan di kiri -> Potong batas akhir menjadi sebelum start_date
        elif a_start < start_date <= a_end <= end_date:
            await db.table("team_assignments").update({
                "end_date": _prev_day(start_date),
                "updated_at": now_iso()
            }).eq("id", a["id"]).execute()

        # KASUS 4: Bersinggungan di kanan -> Potong batas mulai menjadi setelah end_date
        elif start_date <= a_start <= end_date < a_end:
            await db.table("team_assignments").update({
                "start_date": _next_day(end_date),
                "updated_at": now_iso()
            }).eq("id", a["id"]).execute()

    return affected_count


@router.get("/assignments")
async def list_assignments(user: dict = Depends(get_current_user)):
    """Mengambil daftar seluruh riwayat penempatan regu."""
    db = await get_db()
    res = await db.table("team_assignments").select("*").order("start_date", desc=True).limit(5000).execute()
    return res.data or []


@router.post("/assignments")
async def create_assignment(body: AssignmentIn, user: dict = Depends(require_roles("admin", "operator"))):
    """
    Menempatkan satu pegawai ke regu tertentu (mendukung tanggal tunggal atau rentang tanggal).
    Menggunakan algoritma pemotongan interval otomatis agar bebas tabrakan periode.
    """
    db = await get_db()
    emp_res = await db.table("employees").select("*").eq("id", body.employee_id).execute()
    team_res = await db.table("teams").select("*").eq("id", body.team_id).execute()
    emp = emp_res.data[0] if emp_res.data else None
    team = team_res.data[0] if team_res.data else None
    if not emp or not team:
        raise HTTPException(status_code=404, detail="Pegawai / Regu tidak ditemukan")

    # Kasubid tidak boleh ditempatkan ke regu
    kasubids = await get_active_kasubid_ids(body.start_date)
    if body.employee_id in kasubids:
        raise HTTPException(status_code=400, detail=f"Pegawai {emp['nama']} adalah Kasubid dan tidak dapat ditempatkan ke regu.")

    # Terapkan algoritma penataan interval temporal
    doc = await apply_interval_assignment(
        db=db,
        employee_id=body.employee_id,
        team_id=body.team_id,
        start_date=body.start_date,
        end_date=body.end_date
    )

    periode_label = f"mulai {body.start_date}" + (f" s/d {body.end_date}" if body.end_date else " (seterusnya)")
    await write_audit(
        user,
        "Penempatan / Rolling regu",
        employee_name=emp["nama"],
        detail=f"{team['name']} {periode_label}"
    )
    return clean(doc)


@router.post("/assignments/batch")
async def create_batch_assignment(body: BatchAssignmentIn, user: dict = Depends(require_roles("admin", "operator"))):
    """
    Penempatan massal beberapa pegawai ke regu (misal untuk rolling reguler 3 bulan / triwulan).
    Mendukung tanggal tunggal maupun rentang tanggal dengan pemotongan interval otomatis.
    """
    if not body.employee_ids:
        raise HTTPException(status_code=400, detail="Daftar pegawai tidak boleh kosong")

    db = await get_db()
    team_res = await db.table("teams").select("*").eq("id", body.team_id).execute()
    team = team_res.data[0] if team_res.data else None
    if not team:
        raise HTTPException(status_code=404, detail="Regu tujuan tidak ditemukan")

    # Ambil data nama pegawai untuk preview audit log
    emp_res = await db.table("employees").select("id, nama").in_("id", body.employee_ids).execute()
    emps = {e["id"]: e["nama"] for e in (emp_res.data or [])}

    # Kasubid tidak boleh ditempatkan ke regu
    kasubids = await get_active_kasubid_ids(body.start_date)
    kasubid_in_list = [eid for eid in body.employee_ids if eid in kasubids]
    if kasubid_in_list:
        k_names = [emps.get(eid, eid) for eid in kasubid_in_list]
        raise HTTPException(status_code=400, detail=f"Pegawai ({', '.join(k_names)}) adalah Kasubid dan tidak dapat ditempatkan ke regu.")

    # Terapkan pemotongan interval dan simpan penempatan untuk setiap pegawai yang dipilih
    success_count = 0
    names_assigned = []
    for eid in body.employee_ids:
        if eid not in emps:
            continue
        await apply_interval_assignment(
            db=db,
            employee_id=eid,
            team_id=body.team_id,
            start_date=body.start_date,
            end_date=body.end_date
        )
        success_count += 1
        names_assigned.append(emps[eid])

    # Format catatan audit log
    emp_preview = ", ".join(names_assigned[:3])
    if len(names_assigned) > 3:
        emp_preview += f" dan {len(names_assigned) - 3} pegawai lainnya"

    periode_label = f"mulai {body.start_date}" + (f" s/d {body.end_date}" if body.end_date else " (seterusnya)")
    await write_audit(
        user,
        "Penempatan / Rolling regu batch",
        employee_name=emp_preview,
        detail=f"{success_count} pegawai ke {team['name']} {periode_label}"
    )

    return {
        "count": success_count,
        "team_id": body.team_id,
        "team_name": team["name"],
        "start_date": body.start_date,
        "end_date": body.end_date,
    }


@router.post("/assignments/check-conflicts")
async def check_assignment_conflicts(
    body: BatchAssignmentIn,
    user: dict = Depends(require_roles("admin", "operator"))
):
    """
    Pengecekan konflik dan penimpaan (override) penempatan regu sebelum rolling disimpan.
    Mengembalikan daftar penempatan yang bersinggungan untuk konfirmasi pengguna.
    """
    if not body.employee_ids:
        return {"has_conflicts": False, "conflicts": []}

    db = await get_db()
    new_start = body.start_date
    new_end_cap = body.end_date or "9999-12-31"

    # 1. Ambil data nama regu
    teams_res = await db.table("teams").select("id, name").execute()
    teams_map = {t["id"]: t["name"] for t in (teams_res.data or [])}
    target_team_name = teams_map.get(body.team_id, "Regu Tujuan")

    # 2. Ambil data nama pegawai
    emp_res = await db.table("employees").select("id, nama, nip").in_("id", body.employee_ids).execute()
    emps_map = {e["id"]: e for e in (emp_res.data or [])}

    # 3. Ambil penempatan yang sudah ada untuk pegawai yang dipilih
    assign_res = await db.table("team_assignments").select("*").in_("employee_id", body.employee_ids).execute()
    assignments = assign_res.data or []

    conflicts = []
    for a in assignments:
        eid = a["employee_id"]
        a_start = a["start_date"]
        a_end = a.get("end_date") or "9999-12-31"

        # Cek apakah interval a bersinggungan dengan rentang baru [new_start, new_end_cap]
        if a_start <= new_end_cap and a_end >= new_start:
            emp = emps_map.get(eid, {})
            existing_team_name = teams_map.get(a["team_id"], "Regu Lain")
            is_different_team = a["team_id"] != body.team_id

            conflicts.append({
                "assignment_id": a["id"],
                "employee_id": eid,
                "employee_nama": emp.get("nama", "Pegawai"),
                "employee_nip": emp.get("nip", ""),
                "existing_team_id": a["team_id"],
                "existing_team_name": existing_team_name,
                "existing_start_date": a["start_date"],
                "existing_end_date": a.get("end_date"),
                "target_team_id": body.team_id,
                "target_team_name": target_team_name,
                "new_start_date": body.start_date,
                "new_end_date": body.end_date,
                "is_different_team": is_different_team,
            })

    conflicts.sort(key=lambda x: (x["employee_nama"], x["existing_start_date"]))

    return {
        "has_conflicts": len(conflicts) > 0,
        "conflict_count": len(conflicts),
        "conflicts": conflicts,
    }


@router.delete("/assignments/{aid}")
async def delete_assignment(aid: str, user: dict = Depends(require_roles("admin"))):
    """Menghapus satu baris penempatan regu berdasarkan ID."""
    db = await get_db()
    await db.table("team_assignments").delete().eq("id", aid).execute()
    await write_audit(user, "Menghapus penempatan regu")
    return {"ok": True}


@router.post("/assignments/reset")
async def reset_assignments(
    body: Optional[ResetAssignmentsIn] = None,
    team_id: Optional[str] = None,
    user: dict = Depends(require_roles("admin"))
):
    """
    Reset penempatan regu dengan fleksibilitas lingkup:
    - mode 'single': Kosongkan penempatan hanya pada 1 tanggal spesifik (misal tanggal acuan terpilih)
    - mode 'range': Kosongkan penempatan untuk rentang tanggal tertentu (start_date s/d end_date)
    - mode 'all': Kosongkan seluruh riwayat penempatan (semua tanggal dari awal)
    Dapat dibatasi untuk satu regu tertentu (team_id) atau semua regu.
    """
    db = await get_db()

    # Ekstrak parameter dari body atau query params untuk kompatibilitas ke belakang
    mode = body.mode if body else ("all" if not team_id else "all")
    target_team = body.team_id if (body and body.team_id) else team_id
    reset_att = body.reset_attendance_teams if body else True

    # 1. Reset untuk Tanggal Tunggal (Single Date)
    if mode == "single":
        ref_date = (body.date if body and body.date else None) or _date.today().isoformat()
        deleted_count = await slice_out_interval_for_assignments(
            db=db,
            start_date=ref_date,
            end_date=ref_date,
            team_id=target_team
        )
        # Sinkronkan kolom team_id di data absensi untuk tanggal tersebut
        if reset_att:
            try:
                att_q = db.table("attendance").update({
                    "team_id": None,
                    "updated_at": now_iso()
                }).eq("date", ref_date)
                if target_team:
                    att_q = att_q.eq("team_id", target_team)
                await att_q.execute()
            except Exception:
                pass
        scope_desc = f"tanggal {ref_date}"

    # 2. Reset untuk Rentang Tanggal (Date Range)
    elif mode == "range":
        start_d = (body.start_date if body and body.start_date else None) or _date.today().isoformat()
        end_d = (body.end_date if body and body.end_date else None) or start_d
        deleted_count = await slice_out_interval_for_assignments(
            db=db,
            start_date=start_d,
            end_date=end_d,
            team_id=target_team
        )
        # Sinkronkan kolom team_id di data absensi untuk rentang tanggal tersebut
        if reset_att:
            try:
                att_q = db.table("attendance").update({
                    "team_id": None,
                    "updated_at": now_iso()
                }).gte("date", start_d).lte("date", end_d)
                if target_team:
                    att_q = att_q.eq("team_id", target_team)
                await att_q.execute()
            except Exception:
                pass
        scope_desc = f"periode {start_d} s/d {end_d}"

    # 3. Reset Total (Semua Tanggal)
    else:
        if target_team:
            res = await db.table("team_assignments").delete().eq("team_id", target_team).execute()
        else:
            res = await db.table("team_assignments").delete().neq("id", "").execute()
        deleted_count = len(res.data) if res.data else 0

        # Sinkronkan kolom team_id di seluruh data absensi
        if reset_att:
            try:
                att_q = db.table("attendance").update({
                    "team_id": None,
                    "updated_at": now_iso()
                })
                if target_team:
                    att_q = att_q.eq("team_id", target_team)
                else:
                    att_q = att_q.neq("id", "")
                await att_q.execute()
            except Exception:
                pass
        scope_desc = "seluruh periode (reset total)"

    team_desc = "regu terpilih" if target_team else "semua regu"
    await write_audit(
        user,
        "Reset penempatan regu",
        detail=f"{deleted_count} penempatan disesuaikan ({team_desc}, {scope_desc})"
    )

    return {
        "deleted": deleted_count,
        "mode": mode,
        "team_id": target_team,
        "scope": scope_desc
    }
