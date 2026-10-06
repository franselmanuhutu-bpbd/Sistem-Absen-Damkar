# PRD — Sistem Informasi Absensi DAMKAR Kabupaten Mimika

## Problem Statement
Aplikasi web administrasi absensi harian pegawai Pemadam Kebakaran (DAMKAR) Kabupaten Mimika: input absensi per regu, rolling pegawai antarregu berbasis periode tanpa merusak histori, rekap bulanan & rentang periode, export Excel/PDF resmi, dashboard, kalender, audit log, backup, dan login multi-role.

## Architecture
- FastAPI + React + MongoDB (platform-optimal pengganti Flask/PostgreSQL yang diminta; seluruh fitur terpenuhi & siap online).
- Auth: JWT Bearer (localStorage `damkar_token`), bcrypt hashing, role admin/operator/viewer.
- Koleksi: users, employees, teams, team_assignments, attendance, audit_logs.
- Logika rolling: `resolve_teams_for_date()` menentukan regu pegawai pada tanggal tertentu; absensi menyimpan `team_id` saat input sehingga histori tetap akurat.

## User Personas
- **Admin** (Kepala/IT): kelola pegawai, regu, user, absensi, export, backup.
- **Operator piket**: input absensi harian (sering via HP), rekap, export.
- **Viewer/Kepala Bidang**: read-only dashboard, rekap, laporan.

## Core Requirements (static)
6 regu; rolling berbasis tanggal; batch multi-select absensi; 6 kategori (HDR/OFF/SKT/TK/IZN/DL); dashboard per tanggal & per regu; rekap bulanan & periode bebas (1/3/6/12/custom) + breakdown; kalender; data pegawai + import Excel; manajemen regu; export Excel & PDF resmi (kop Pemkab Mimika); audit log; backup; keamanan (hashing, RBAC, validasi); responsif mobile.

## Implemented (2026-10-06)
- ✅ Auth JWT + 3 role + RBAC (route guard + sidebar) + seed admin/operator/viewer
- ✅ 54 pegawai seed dari Excel, 6 regu, assignment 2026-01-01, demo absensi Jan–Okt 2026
- ✅ Dashboard (tanggal, total, per status, per regu, grafik)
- ✅ Input Absensi batch multi-select + sticky action bar (mobile friendly)
- ✅ Rekap Bulanan + totals + export
- ✅ Rekap Periode (quick 1/3/6/12 + custom) + tab Total & Breakdown + export
- ✅ Kalender + detail harian
- ✅ Data Pegawai (CRUD, search, nonaktifkan, import Excel, riwayat regu)
- ✅ Manajemen Regu + rolling (tutup otomatis penempatan lama)
- ✅ Export Excel multi-sheet + PDF resmi A4 landscape
- ✅ User Management, Audit Log, Backup JSON
- ✅ Testing: 26/26 backend pass, frontend core flows pass, rolling integrity verified

## Backlog / Next
- P1: Unify testid export buttons; split server.py into routers
- P2: Recharts minHeight polish (done); kolom TK label konsistensi; filter pegawai spesifik pada export
- P2: Reaktivasi pegawai/user dari UI; pagination untuk audit log besar

## Next Tasks
- Kumpulkan feedback operator lapangan terhadap alur Input Absensi di HP.
- Siapkan deployment online (env eksplisit, MongoDB Atlas).

## Update (2026-10-06) — Struktur Historis, Komandan, Kasubid, Self-Service
Fitur lanjutan historis (effective-date) selesai & teruji (42/42 backend tests pass):
- ✅ **Histori per-tanggal**: `_compute_recap` kini resolve regu PER TANGGAL absensi (bukan posisi terkini). Laporan periode lama tidak berubah saat rolling. Breakdown long-format per (pegawai, regu, bulan). Label regu periode menampilkan transisi "Regu A → Regu B".
- ✅ **Validasi**: overlap penempatan ditolak; satu pegawai satu regu aktif; Kasubid 1 ≠ Kasubid 2 pada periode sama.
- ✅ **Rename Regu** (team_id permanen, histori aman)
- ✅ **Komandan Regu** berbasis periode (`team_commanders`) + resolve by date + riwayat
- ✅ **Kasubid 1 & 2** berbasis periode (`sub_unit_assignments`) + resolve by date
- ✅ **Rekap Kasubid**: ringkasan + detail harian filter status + Export Excel (3 sheet) & PDF resmi
- ✅ **Absensi Saya** (self-service): profil, rekap klik-status→tanggal, kalender pribadi, riwayat regu
- ✅ **Role baru**: komandan, kasubid, staff (user ditautkan ke pegawai) + RBAC nav/route
- ✅ **Dashboard** menampilkan Kasubid 1/2 + komandan tiap regu
- ✅ Konfirmasi rolling + peringatan histori di UI; Riwayat perubahan anggota regu
- Seed: komandan = anggota pertama tiap regu (2026-01-01); KASUBID1=Yosep, KASUBID2=Daud.
- Catatan backlog: split server.py ke routers; preload sub_unit_assignments untuk perf kasubid recap.


## Update (2026-10-06) — Akun Bersama Staff & Perbaikan Kategori Kasubid
- ✅ **Akun bersama staff**: `staffdamkar@go.id` / `Damkar142`, role viewer (read-only: Dashboard, Kalender, Rekap Bulanan/Periode/Kasubid, Export Excel/PDF). Bisa dipakai banyak staff bersamaan (JWT stateless). Di-seed idempotent di `seed()`.
- ✅ **Kategori Kasubid di rekap**: `_compute_recap` kini hanya memberi label "Kasubid" pada pemegang posisi kasubid yang AKTIF saat ini (resolve per posisi via `resolve_kasubid_for_date(pid, today)`, konsisten dengan halaman roster Kasubid). Mantan kasubid/penugasan historis yang sudah berakhir tampil sebagai "Staff". Terverifikasi: rekap menampilkan 1 Kasubid (Yosep Bleskadit) + 53 Staff.
- Testing: curl login + rekap + export (200), screenshot UI login & Rekap Bulanan pass, tanpa overflow layout.