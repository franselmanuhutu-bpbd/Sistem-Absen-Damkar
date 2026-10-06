# Sistem Informasi Absensi DAMKAR — Kabupaten Mimika

Aplikasi web administrasi absensi harian pegawai Dinas Pemadam Kebakaran & Penyelamatan Kabupaten Mimika.

## Fitur Utama
- Login & role-based access (ADMIN / OPERATOR / VIEWER) — JWT, password di-hash dengan bcrypt
- 6 Regu DAMKAR + sistem **rolling** pegawai berbasis periode/tanggal (histori absensi masa lalu tidak berubah saat regu diganti)
- Input absensi harian dengan **batch multi-select** (pilih banyak pegawai lalu tandai HDR/OFF/SKT/TK/IZN/DL sekaligus)
- Dashboard statistik harian + per regu + grafik
- Rekap Bulanan & Rekap Rentang Periode (1/3/6/12 bulan / custom) + Breakdown per bulan
- Kalender absensi + detail per tanggal
- Data Pegawai: CRUD, import Excel, nonaktifkan (ACTIVE/INACTIVE), riwayat penempatan regu
- Export **Excel** (multi-sheet: Ringkasan, Breakdown, Detail) & **PDF resmi** (kop surat Pemkab Mimika, A4 landscape, header berulang, nomor halaman)
- Audit log seluruh perubahan
- Backup database (JSON)

## Arsitektur
- **Backend:** FastAPI (Python) — `/app/backend/server.py`, semua route prefix `/api`
- **Frontend:** React + Tailwind + shadcn/ui — `/app/frontend/src`
- **Database:** MongoDB (koleksi: `users`, `employees`, `teams`, `team_assignments`, `attendance`, `audit_logs`)

## Menjalankan Secara Lokal
Backend dan frontend dikelola oleh supervisor.

```bash
# restart service setelah perubahan .env / dependency
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# backend: FastAPI di 0.0.0.0:8001 (route /api/*)
# frontend: React di port 3000
```

### Environment Variables
Backend (`/app/backend/.env`):
```
MONGO_URL=...          # koneksi MongoDB
DB_NAME=...            # nama database
CORS_ORIGINS=...       # origin frontend (gunakan daftar eksplisit di produksi)
JWT_SECRET=...         # rahasia JWT (jangan di-commit)
ADMIN_EMAIL=...        # akun admin awal (auto-seed)
ADMIN_PASSWORD=...     # password admin awal (auto-seed)
```
Frontend (`/app/frontend/.env`):
```
REACT_APP_BACKEND_URL=...   # URL publik backend
```
> Jangan menyimpan SECRET_KEY / password / credential di dalam source code. Gunakan environment variables.

## Akun Default (seed)
| Role     | Email                         | Password     |
|----------|-------------------------------|--------------|
| Admin    | fransel.manuhutu@gmail.com    | Damkar2026!  |
| Operator | operator@damkar.go.id         | Damkar2026!  |
| Viewer   | kepala@damkar.go.id           | Damkar2026!  |

## Data Awal
54 pegawai diimport dari `Project Absen.xlsx` (lihat `/app/backend/seed_data.py`), didistribusikan ke 6 regu mulai 1 Januari 2026, dengan demo absensi Jan–Okt 2026. Admin dapat mengatur ulang penempatan via menu **Manajemen Regu**.

## Deployment Online
Aplikasi siap dideploy. Pastikan environment variables terisi di platform tujuan dan `CORS_ORIGINS` memakai origin frontend yang eksplisit. Database dapat dipindah ke MongoDB managed (Atlas) dengan mengganti `MONGO_URL`.
