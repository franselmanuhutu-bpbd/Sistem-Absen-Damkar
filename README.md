# Sistem Informasi Absensi DAMKAR Kabupaten Mimika

Sistem Informasi Absensi Badan Penanggulangan Bencana Daerah (BPBD) - Bidang Pemadam Kebakaran dan Penyelamatan Kabupaten Mimika adalah aplikasi manajemen kehadiran, penempatan regu, pelaporan, dan audit terpadu. Sistem ini dirancang untuk menangani dinamika rotasi personel pemadam kebakaran secara akurat tanpa merusak riwayat kehadiran masa lalu.

---

## Daftar Isi
- [Ringkasan Eksekutif](#ringkasan-eksekutif)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Komponen Teknologi](#komponen-teknologi)
- [Arsitektur Basis Data](#arsitektur-basis-data)
- [Mekanisme dan Logika Bisnis Utama](#mekanisme-dan-logika-bisnis-utama)
- [Katalog Endpoint API](#katalog-endpoint-api)
- [Arsitektur Frontend](#arsitektur-frontend)
- [Struktur Direktori Repositori](#struktur-direktori-repositori)
- [Variabel Lingkungan](#variabel-lingkungan)
- [Panduan Instalasi dan Pengembangan Lokal](#panduan-instalasi-dan-pengembangan-lokal)
- [Arsitektur Build dan Deployment](#arsitektur-build-dan-deployment)
- [Operasional dan Pemeliharaan](#operasional-dan-pemeliharaan)

---

## Ringkasan Eksekutif

Aplikasi ini melayani pencatatan kehadiran personel pemadam kebakaran Mimika yang terbagi dalam regu operasional dan satuan struktural:
- 6 Regu Operasional DAMKAR (Regu A sampai F) beserta Komandan Regu.
- Satuan Struktural Sub Bidang (Kasubid Pencegahan dan Kasubid Penanggulangan).
- Staf pendukung dan administrasi BPBD Mimika.

Aplikasi memfasilitasi pencatatan status kehadiran harian (HDR, OFF, SKT, TK, IZN, DL), mutasi atau rotasi regu berkala (rolling), pelaporan eksekutif berformat resmi (PDF & Excel), pemantauan mandiri oleh personel, serta notifikasi Web Push berbasis standar VAPID.

---

## Arsitektur Sistem

Sistem mengadopsi pola arsitektur Client-Server terpisah (Decoupled Single Page Application & REST API) dengan komunikasi melalui JSON over HTTP/HTTPS:

```mermaid
flowchart TD
    subgraph Klien["Lapisan Klien (Frontend)"]
        Browser["Web Browser (Desktop / Mobile PWA)"]
        ServiceWorker["Service Worker (Web Push)"]
    end

    subgraph Gerbang["Lapisan Proksi & Routing"]
        VercelRouting["Vercel Edge / Bun Dev Server Proxy"]
    end

    subgraph LayananAPI["Lapisan Aplikasi (Backend FastAPI)"]
        FastAPIApp["FastAPI Server (server.py)"]
        AuthModule["Autentikasi & RBAC (auth.py)"]
        DomainRouters["Modular Routers (routers/*.py)"]
        ExportEngine["Export Engine (ReportLab & OpenPyXL)"]
        PushService["Web Push Engine (pywebpush)"]
    end

    subgraph Penyimpanan["Lapisan Data & Penyimpanan"]
        SupabasePostgrest["Supabase PostgREST API (AsyncClient)"]
        PostgreSQLDirect["PostgreSQL Engine (Direct DDL / psycopg)"]
        LocalFileFallback["Fallback Storage (push_subscriptions.json)"]
    end

    Browser -->|HTTP Requests / Static Assets| VercelRouting
    ServiceWorker -->|Push Notifications| Browser
    VercelRouting -->|Route: /api/*| FastAPIApp
    FastAPIApp --> AuthModule
    FastAPIApp --> DomainRouters
    DomainRouters --> ExportEngine
    DomainRouters --> PushService
    DomainRouters -->|Async CRUD Queries| SupabasePostgrest
    FastAPIApp -->|Startup DDL & Schema Assurance| PostgreSQLDirect
    PushService -->|Local Subscription Store Fallback| LocalFileFallback
    SupabasePostgrest --> PostgreSQLDirect
```

---

## Komponen Teknologi

### Frontend
- Runtime & Bundler: Bun (v1.2+)
- Framework Klien: React 19 dengan TypeScript
- Desain Sistem & Antarmuka: Tailwind CSS v4, Radix UI primitives, Lucide React
- Pengelolaan Status & Cache Klien: TanStack React Query v5, SWR, Axios
- Visualisasi Data: Recharts
- Navigasi & Routing: React Router DOM v7
- Push Klien: PWA Service Worker (VAPID API)

### Backend
- Framework API: FastAPI (Python 3.11 / 3.14)
- ASGI Server: Uvicorn Standard
- Validasi & Model Data: Pydantic v2
- Keamanan & Token: PyJWT (HS256), Bcrypt
- Mesin Pelaporan: ReportLab (PDF A4 Landscape resmi), OpenPyXL & Pandas (Excel multi-sheet)
- Notifikasi: PyWebPush (Web Push Protocol RFC 8291/8292)

### Basis Data & Infrastruktur
- DBMS Utama: PostgreSQL di platform Supabase
- Akses Data: Supabase Python Client (Asynchronous PostgREST) dan Psycopg 3 (Direct DDL Migration)
- Hosting & CDN: Vercel (Multi-service build)
- Otomasi CI/CD: GitHub Actions (Vercel Deploy Hook)

---

## Arsitektur Basis Data

Sistem menggunakan basis data relasional PostgreSQL dengan Row Level Security (RLS) aktif di seluruh tabel. Hak akses administratif diberikan kepada peran `service_role` yang digunakan oleh FastAPI.

### Diagram Entitas Relasi (ERD)

```mermaid
erDiagram
    USERS {
        text id PK
        text name
        text email UK
        text password_hash
        text role
        text status
        text employee_id FK
        timestamptz created_at
    }

    EMPLOYEES {
        text id PK
        integer no
        text nama
        text nip
        text pangkat
        text jabatan
        text status
        timestamptz created_at
    }

    TEAMS {
        text id PK
        text name
        text code UK
        integer order
    }

    TEAM_ASSIGNMENTS {
        text id PK
        text employee_id FK
        text team_id FK
        text start_date
        text end_date
        timestamptz created_at
        timestamptz updated_at
    }

    TEAM_COMMANDERS {
        text id PK
        text team_id FK
        text employee_id FK
        text start_date
        text end_date
        timestamptz created_at
        timestamptz updated_at
    }

    SUB_UNIT_ASSIGNMENTS {
        text id PK
        text position_id
        text employee_id FK
        text start_date
        text end_date
        timestamptz created_at
        timestamptz updated_at
    }

    ATTENDANCE {
        text id PK
        text employee_id FK
        text date
        text status
        text team_id
        timestamptz created_at
        timestamptz updated_at
        text updated_by
    }

    AUDIT_LOGS {
        text id PK
        timestamptz timestamp
        text user_email
        text user_name
        text action
        text employee_name
        text detail
        text date
        text old_status
        text new_status
    }

    PUSH_SUBSCRIPTIONS {
        text id PK
        text user_id FK
        text endpoint UK
        text p256dh
        text auth
        text user_agent
        timestamptz created_at
        timestamptz updated_at
    }

    EMPLOYEES ||--o| USERS : "dihubungkan ke"
    EMPLOYEES ||--o{ TEAM_ASSIGNMENTS : "ditempatkan melalui"
    TEAMS ||--o{ TEAM_ASSIGNMENTS : "memiliki anggota"
    EMPLOYEES ||--o{ TEAM_COMMANDERS : "menjabat di"
    TEAMS ||--o{ TEAM_COMMANDERS : "dipimpin oleh"
    EMPLOYEES ||--o{ SUB_UNIT_ASSIGNMENTS : "menjabat posisi"
    EMPLOYEES ||--o{ ATTENDANCE : "memiliki catatan"
    USERS ||--o{ PUSH_SUBSCRIPTIONS : "memiliki perangkat"
```

### Tabel-Tabel Utama

1. `users`: Menyimpan kredensial pengguna, peran hak akses (`admin`, `operator`, `viewer`, `komandan`, `kasubid`, `staff`), status akun, dan relasi ke data pegawai.
2. `employees`: Menyimpan data induk pegawai (Nomor urut, Nama, NIP, Pangkat/Golongan, Jabatan struktural, Status aktif/nonaktif).
3. `teams`: Master data 6 regu pemadam kebakaran.
4. `team_assignments`: Riwayat penempatan personel ke regu dengan rentang tanggal (`start_date` dan `end_date`).
5. `team_commanders`: Riwayat penugasan komandan regu pada interval tanggal tertentu.
6. `sub_unit_assignments`: Penugasan Kepala Sub Bidang (`KASUBID1` = Kasubid Pencegahan, `KASUBID2` = Kasubid Penanggulangan).
7. `attendance`: Catatan transaksi kehadiran harian dengan batasan unik komposit `(employee_id, date)`.
8. `audit_logs`: Jejak audit setiap perubahan data kehadiran, mutasi pegawai, manipulasi pengguna, dan proses backup data.
9. `push_subscriptions`: Endpoint dan kunci enkripsi peramban (P-256DH dan Auth Secret) untuk Web Push.

---

## Mekanisme dan Logika Bisnis Utama

### 1. Sistem Rolling Pegawai Tanpa Merusak Histori
Dalam operasional DAMKAR, personel dipindahkan antar-regu secara berkala (misalnya rotasi 3 atau 6 bulan sekali). Pendekatan penyimpanan langsung `team_id` pada tabel pegawai akan merusak histori rekap kehadiran masa lalu.

Sistem mengatasi ini melalui entitas `team_assignments` dengan model rentang waktu:
- Setiap penempatan baru pada tanggal `start_date` secara otomatis menutup penempatan sebelumnya pada `start_date - 1 hari` (`end_date`).
- Saat menghitung roster atau mencetak laporan periode tanggal `T`, regu pegawai ditentukan berdasarkan kondisi:
  `start_date <= T AND (end_date IS NULL OR end_date >= T)`
- Hasilnya, laporan kehadiran bulan-bulan lalu tetap mencerminkan regu riil pegawai saat itu, sedangkan roster hari ini mencerminkan regu terbarunya.

### 2. Resolusi Roster & Input Presensi Batch
- Operasi input presensi harian mendukung seleksi multi-pegawai (batch select).
- Setiap pembaharuan status memicu penyimpanan atomic ke tabel `attendance` dan pencatatan riwayat perubahan ke tabel `audit_logs` (mencatat siapa operator yang mengubah, nilai lama, nilai baru, dan waktu modifikasi).
- Batasan status absensi: `HDR` (Hadir), `OFF` (Lepas Tugas), `SKT` (Sakit), `TK` (Tanpa Keterangan), `IZN` (Izin), `DL` (Dinas Luar).

### 3. Matriks Peran dan Kontrol Akses (RBAC)

| Peran | Deskripsi Hak Akses |
|---|---|
| admin | Akses penuh seluruh sistem: Kelola pengguna, manipulasi pegawai, mutasi regu, input absensi, rekapitulasi, ekspor, backup data, dan manajemen notifikasi. |
| operator | Input dan koreksi absensi harian, mutasi pegawai, ekspor laporan rekapitulasi, serta melihat dashboard. |
| viewer | Akses baca saja ke dashboard statistik, rekapitulasi, kalender, dan ekspor laporan. |
| komandan | Melihat roster dan rekapitulasi khusus untuk regu yang dipimpinnya serta portal mandiri. |
| kasubid | Input dan evaluasi absensi satuan sub bidang pencegahan dan penanggulangan. |
| staff | Akses mandiri (Portal Absensi Saya) untuk melihat riwayat kehadiran, rekap, dan kalender pribadi. |

### 4. Mesin Ekspor Laporan Resmi
Sistem menghasilkan dua format keluaran berstandar instansi pemerintah:
- **Dokumen PDF Resmi**:
  - Ukuran lembar: A4 Landscape via ReportLab.
  - Kop surat resmi: Badan Penanggulangan Bencana Daerah Kabupaten Mimika, Bidang Pemadam Kebakaran.
  - Running Header dan Running Footer dengan penomoran halaman otomatis (`Halaman X`).
  - Kolom tanda tangan berjenjang (Mengetahui Kepala Bidang, Kasubid, Komandan Regu).
- **Dokumen Excel Multi-Sheet**:
  - Sheet 1: Ringkasan Rekapitulasi Periode (Total akumulasi per status per pegawai).
  - Sheet 2: Breakdown Bulanan (Rincian per bulan untuk rekap rentang kuartal/semester/tahunan).
  - Sheet 3: Detail Harian (Matriks tanggal 1 hingga 31 lengkap dengan kode status kehadiran).

### 5. Mesin Notifikasi Web Push & Pengingat Cadangan
- Menggunakan standar Web Push (RFC 8291 / RFC 8292) dengan pasangan kunci VAPID.
- Mendukung pengiriman pengingat backup berkala kepada akun administrator apabila selang waktu sejak backup terakhir melampaui ambang batas toleransi (default: 7 hari).

---

## Katalog Endpoint API

Seluruh endpoint backend disajikan melalui prefix tunggal `/api`:

### Autentikasi (`routers/auth.py`)
- `POST /api/auth/login`: Autentikasi email dan kata sandi, menghasilkan JWT token.
- `GET /api/auth/me`: Mengambil profil dan peran pengguna yang sedang terautentikasi.
- `POST /api/auth/logout`: Membersihkan sesi autentikasi.

### Manajemen Pengguna (`routers/users.py`)
- `GET /api/users`: Menampilkan daftar akun pengguna sistem (Khusus Admin).
- `POST /api/users`: Membuat akun pengguna baru.
- `PUT /api/users/{uid}`: Memperbarui profil, peran, atau kata sandi pengguna.
- `DELETE /api/users/{uid}`: Menghapus akun pengguna.

### Data Pegawai (`routers/employees.py`)
- `GET /api/employees`: Mengambil daftar seluruh personel DAMKAR.
- `POST /api/employees`: Menambahkan data personel baru.
- `PUT /api/employees/{eid}`: Memperbarui informasi pegawai (NIP, Nama, Pangkat, Jabatan).
- `POST /api/employees/{eid}/status`: Mengubah status aktif / nonaktif pegawai.
- `GET /api/employees/{eid}/assignments`: Riwayat mutasi regu pegawai tertentu.
- `POST /api/employees/import`: Import massal data pegawai dari berkas spreadsheet Excel.

### Manajemen Regu & Komandan (`routers/teams.py`)
- `GET /api/teams`: Mengambil daftar 6 regu pemadam.
- `PUT /api/teams/{team_id}/rename`: Mengubah nama regu (Khusus Admin).
- `GET /api/teams/{team_id}/members`: Daftar anggota aktif dalam regu.
- `GET /api/teams/{team_id}/commanders`: Riwayat komandan regu.
- `POST /api/commanders`: Menetapkan komandan baru untuk regu tertentu.
- `GET /api/teams/{team_id}/detail`: Informasi detail konfigurasi regu.
- `GET /api/teams/{team_id}/history`: Linimasa penugasan personel pada regu.

### Mutasi & Penempatan Regu (`routers/assignments.py`)
- `GET /api/assignments`: Riwayat seluruh penempatan pegawai dalam sistem.
- `POST /api/assignments`: Melakukan penempatan atau rolling pegawai ke regu baru.
- `DELETE /api/assignments/{aid}`: Menghapus data penempatan tertentu.
- `POST /api/assignments/reset`: Mereset struktur penempatan (Khusus Admin).

### Kehadiran Harian (`routers/attendance.py`)
- `GET /api/attendance/roster`: Mengambil daftar roster pegawai per tanggal dan regu.
- `POST /api/attendance/batch`: Menyimpan atau memperbarui status kehadiran massal.
- `GET /api/attendance/day`: Mengambil seluruh transaksi kehadiran pada tanggal tertentu.

### Rekapitulasi Kehadiran (`routers/recap.py`)
- `GET /api/recap/monthly`: Rekap kehadiran satu bulan penuh per pegawai dan regu.
- `GET /api/recap/period`: Rekapitulasi multi-bulan atau rentang tanggal bebas (1, 3, 6, 12 bulan).
- `GET /api/recap/kasubid`: Rekapitulasi kehadiran khusus jabatan Kasubid.

### Kalender Absensi (`routers/calendar.py`)
- `GET /api/calendar`: Matriks kehadiran bulanan per tanggal untuk kalender visual.

### Satuan Struktural Kasubid (`routers/kasubid.py`)
- `GET /api/kasubid`: Mengambil daftar penugasan struktural Kasubid.
- `POST /api/kasubid`: Menetapkan pegawai pada jabatan Kasubid.
- `POST /api/kasubid/vacate`: Mengosongkan penugasan Kasubid.
- `GET /api/kasubid/roster`: Roster kehadiran sub-unit kasubid per tanggal.

### Dashboard & Struktur Organisasi (`routers/dashboard.py`)
- `GET /api/dashboard`: Metrik harian, persentase kehadiran per regu, dan tren mingguan.
- `GET /api/org-structure`: Pohon struktur organisasi DAMKAR (Kasubid, Regu, Komandan).

### Portal Mandiri Pegawai (`routers/me.py`)
- `GET /api/me/profile`: Informasi data diri pegawai yang tertaut ke akun aktif.
- `GET /api/me/recap`: Rekapitulasi akumulasi kehadiran pribadi.
- `GET /api/me/calendar`: Catatan riwayat status absensi bulanan pribadi.
- `GET /api/me/assignments`: Linimasa penugasan regu pribadi.

### Ekspor Berkas (`routers/exports.py`)
- `GET /api/export/excel`: Ekspor rekapitulasi umum format Excel (.xlsx).
- `GET /api/export/pdf`: Ekspor rekapitulasi resmi format PDF A4 Landscape.
- `GET /api/export/kasubid/excel`: Ekspor rekapitulasi Kasubid format Excel.
- `GET /api/export/kasubid/pdf`: Ekspor rekapitulasi Kasubid format PDF.

### Audit & Cadangan Data (`routers/audit.py`)
- `GET /api/audit`: Menampilkan daftar jejak audit aktivitas sistem.
- `GET /api/backup`: Unduh seluruh data sistem dalam format arsip JSON.
- `GET /api/backup/tables`: Daftar tabel yang tersedia untuk dicadangkan.
- `GET /api/backup/table/{table_name}`: Ekspor data per tabel spesifik.
- `POST /api/backup/record-audit`: Mencatat pelaksanaan backup data ke audit log.

### Notifikasi Web Push (`routers/notifications.py`)
- `GET /api/vapid-public-key`: Mengambil VAPID Public Key untuk pendaftaran peramban.
- `POST /api/subscribe`: Mendaftarkan endpoint langganan Web Push peramban klien.
- `POST /api/unsubscribe`: Membatalkan langganan Web Push.
- `GET /api/backup-status`: Evaluasi status keterkinian cadangan basis data.
- `POST /api/backup-reminder`: Mengirim push notification pengingat backup ke perangkat Admin.
- `POST /api/test`: Pengujian transmisi notifikasi push.

---

## Arsitektur Frontend

Aplikasi frontend dibangun sebagai Single Page Application (SPA) menggunakan Bun runtime:

### Routing Halaman (`frontend/src/pages/`)
- `Login.tsx`: Autentikasi masuk pengguna dengan verifikasi JWT.
- `Dashboard.tsx`: Panel metrik kehadiran hari ini, grafik distribusi status, dan status per regu.
- `InputAbsensi.tsx`: Antarmuka input absensi harian dengan tabel seleksi batch multi-pegawai.
- `RekapBulanan.tsx`: Tabel rekap kehadiran satu bulan kalender.
- `RekapPeriode.tsx`: Tabel rekapitulasi rentang periode fleksibel dengan visualisasi breakdown per bulan.
- `Kalender.tsx`: Tampilan kalender interaktif dengan penanda status kehadiran per hari.
- `DataPegawai.tsx`: Manajemen data induk pegawai, form tambah/edit, dan fitur import Excel.
- `ManajemenRegu.tsx`: Pengaturan 6 regu, riwayat penugasan, dan pergantian komandan regu.
- `LaporanExport.tsx`: Halaman konfigurasi filter dan ekspor dokumen PDF & Excel resmi.
- `AuditLog.tsx`: Penampil linimasa jejak audit sistem dan panel unduh backup database.
- `UserManagement.tsx`: Panel administrasi pengguna akun dan pembagian peran.
- `AbsensiSaya.tsx`: Portal mandiri personel untuk memantau presensi pribadi.
- `AbsensiKasubid.tsx` & `PengaturanKasubid.tsx`: Modul operasional sub-bidang pencegahan dan penanggulangan.

### Komponen Inti (`frontend/src/components/`)
- `Layout.tsx`: Rangka utama aplikasi (Sidebar navigasi, Header profil pengguna, Tombol switch tema gelap/terang, dan Indikator koneksi).
- `NetworkStatusBadge.tsx`: Pemantau status latensi dan konektivitas API secara langsung.
- `MonthPicker.tsx`: Komponen pemilih bulan dan tahun kustom.
- `StatusBadge.tsx`: Lencana visual berwarna untuk representasi status presensi (HDR, OFF, SKT, TK, IZN, DL).
- `ui/`: Koleksi komponen berbasis Radix UI (Dialog, Dropdown, Table, Tabs, Select, Input, Button, Card, Toast Sonner).

---

## Struktur Direktori Repositori

```
Sistem-Absen-Damkar/
|-- .github/
|   `-- workflows/
|       `-- ci.yml                  # Otomasi deployment Vercel via GitHub Actions
|-- backend/
|   |-- data/                       # Penyimpanan fallback file lokal (misal: subscriptions)
|   |-- routers/                    # Router modular FastAPI
|   |   |-- assignments.py          # Mutasi dan penempatan regu
|   |   |-- attendance.py           # Transaksi kehadiran dan roster
|   |   |-- audit.py                # Jejak audit dan backup JSON
|   |   |-- auth.py                 # Autentikasi pengguna
|   |   |-- calendar.py             # Agregasi data kalender
|   |   |-- dashboard.py            # Statistik dan struktur organisasi
|   |   |-- employees.py            # CRUD pegawai dan import Excel
|   |   |-- exports.py              # Generator ReportLab PDF & OpenPyXL Excel
|   |   |-- kasubid.py              # Satuan struktural Kepala Sub Bidang
|   |   |-- me.py                   # Portal presensi mandiri pegawai
|   |   |-- notifications.py        # Endpoint Web Push
|   |   |-- recap.py                # Kalkulasi rekap bulanan dan periode
|   |   |-- teams.py                # Master regu dan komandan
|   |   `-- users.py                # Administrasi akun pengguna
|   |-- services/
|   |   `-- notifications.py        # Layanan pywebpush & verifikasi backup
|   |-- tests/
|   |   `-- verify_supabase.py      # Pengujian konektivitas Supabase
|   |-- auth.py                     # Utilitas enkripsi kata sandi dan JWT
|   |-- config.py                   # Parsing environment variables dan konstanta
|   |-- database.py                 # Inisialisasi Supabase PostgREST & psycopg DDL
|   |-- models.py                   # Skema validasi Pydantic v2
|   |-- requirements.txt            # Dependensi paket Python
|   |-- schema.sql                  # Skrip DDL PostgreSQL, indeks, dan RLS
|   |-- seed_data.py                # Seeding data induk pegawai DAMKAR Mimika
|   |-- server.py                   # Entry point aplikasi FastAPI
|   `-- utils.py                    # Logika perhitungan rekapitulasi dan utilitas
|-- frontend/
|   |-- public/
|   |   `-- sw.js                   # Service Worker untuk Web Push
|   |-- src/
|   |   |-- components/             # Komponen antarmuka dan UI shadcn
|   |   |-- constants/              # Konstanta status, warna, dan peran
|   |   |-- context/                # Context autentikasi klien
|   |   |-- hooks/                  # Custom React hooks
|   |   |-- lib/                    # Klien HTTP Axios dan utilitas
|   |   |-- pages/                  # Halaman aplikasi React
|   |   |-- App.tsx                 # Definisi rute React Router
|   |   |-- frontend.tsx            # Mounting React DOM root
|   |   |-- index.css               # Variabel CSS tema dan konfigurasi Tailwind
|   |   |-- index.html              # Template tunggal SPA
|   |   `-- index.ts                # Server Bun development dengan API reverse-proxy
|   |-- build.ts                    # Skrip bundling produksi Bun
|   |-- bunfig.toml                 # Konfigurasi runtime Bun
|   |-- package.json                # Dependensi modul Bun dan skrip
|   |-- postcss.config.js           # Konfigurasi PostCSS Tailwind
|   |-- tailwind.config.js          # Pengaturan palet dan styling Tailwind
|   `-- tsconfig.json               # Konfigurasi kompilasi TypeScript
|-- .env.example                    # Template konfigurasi variabel lingkungan
|-- vercel.json                     # Konfigurasi deployment multi-layanan Vercel
`-- README.md                       # Dokumentasi teknis proyek
```

---

## Variabel Lingkungan

Konfigurasi aplikasi dikelola melalui file `.env` di root direktori proyek atau dalam direktori `backend/.env`:

| Variabel | Keterangan | Contoh Nilai |
|---|---|---|
| `SUPABASE_URL` | URL endpoint instansi Supabase | `https://xyzcompany.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase Service Role Secret Key (Bypass RLS) | `eyJhbGciOi...` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Public Key (Opsional) | `eyJhbGciOi...` |
| `POSTGRESQL_DATABASE_URL` | String koneksi direct PostgreSQL untuk DDL otomatis | `postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres` |
| `JWT_SECRET` | Kunci rahasia penandatanganan JSON Web Token | `kunci-rahasia-jwt-32-karakter` |
| `VAPID_PUBLIC_KEY` | Public Key VAPID untuk pendaftaran Web Push peramban | `BOqmEeXmOi...` |
| `VAPID_PRIVATE_KEY` | Private Key VAPID untuk pengiriman notifikasi dari server | `ziQlouKe...` |
| `VAPID_CLAIM_EMAIL` | Alamat email klaim subyek VAPID (RFC 8292) | `mailto:admin@damkar.mimika.go.id` |
| `PORT` | Port server Bun frontend (Opsional, default 3000) | `3000` |
| `BACKEND_URL` | Target alamat backend untuk proxy server dev Bun | `http://localhost:8000` |

---

## Panduan Instalasi dan Pengembangan Lokal

### Prasyarat Perangkat Lunak
1. Python versi 3.11 atau lebih baru
2. Bun versi 1.2 atau lebih baru
3. Proyek PostgreSQL / Supabase aktif

### 1. Kloning Repositori dan Konfigurasi Environment
```bash
git clone https://github.com/franselmanuhutu-bpbd/Sistem-Absen-Damkar.git
cd Sistem-Absen-Damkar
cp .env.example .env
```
Isi nilai-nilai konfigurasi pada file `.env` sesuai kredensial Supabase Anda.

### 2. Menjalankan Backend (FastAPI)
Buka terminal pertama:
```bash
cd backend
python -m venv venv

# Aktivasi virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Aktivasi virtual environment (Linux / macOS)
# source venv/bin/activate

pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```
Saat server backend dijalankan pertama kali, fungsi `ensure_schema()` akan memverifikasi keberadaan tabel dan indeks di PostgreSQL.

Dokumentasi interaktif OpenAPI dapat diakses di:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 3. Menjalankan Frontend (Bun + React)
Buka terminal kedua:
```bash
cd frontend
bun install
bun run dev
```
Server pengembangan Bun akan aktif di [http://localhost:3000](http://localhost:3000). Semua pemanggilan rute `/api/*` secara otomatis diproksikan ke backend FastAPI di port 8000.

---

## Arsitektur Build dan Deployment

### Deployment Vercel Multi-Service
Proyek telah dikonfigurasi untuk deployment Vercel melalui `vercel.json`:
- Layanan Frontend:
  - Root: `frontend`
  - Perintah Instalasi: `bun install`
  - Perintah Build: `bun run build`
  - Direktori Output: `frontend/dist`
  - Aturan Rewrite: Semua rute dialihkan ke `/index.html` untuk mendukung SPA client-side routing.
- Layanan Backend:
  - Root: `backend`
  - Framework: `fastapi` (Serverless Python functions)
- Routing Reverse Proxy:
  - Pola `/api/(.*)` diarahkan ke layanan `api`.
  - Pola `/(.*)` diarahkan ke layanan `web`.

### Integrasi CI/CD GitHub Actions
Alur kerja otomatis tersedia pada `.github/workflows/ci.yml`:
- Trigger: Setiap aksi `push` ke branch `master` yang melibatkan perubahan pada `backend/**`, `frontend/**`, atau `vercel.json`.
- Mekanisme: Memanggil Vercel Deploy Hook melalui HTTP POST untuk memicu deployment tanpa cache (`buildCache=false`).

---

## Operasional dan Pemeliharaan

### Inisialisasi Data Master (Seeding)
Untuk menginisialisasi master 6 regu pemadam dan daftar pegawai awal dari data referensi BPBD Mimika:
```bash
cd backend
python seed_data.py
```

### Prosedur Cadangan Basis Data (Backup)
- Melalui Antarmuka: Administrator dapat menuju menu "Audit Log & Backup" pada aplikasi web dan mengklik tombol "Download Backup JSON".
- Melalui API: Panggilan ke `GET /api/backup` mengembalikan arsip JSON lengkap seluruh tabel sistem (`users`, `teams`, `employees`, `team_assignments`, `team_commanders`, `sub_unit_assignments`, `attendance`, `audit_logs`).
- Seluruh tindakan pencadangan otomatis tercatat pada tabel `audit_logs` untuk memperbarui status pemantauan jadwal backup.
