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
