# DAMKAR Mimika — Frontend

Aplikasi frontend Sistem Informasi Absensi DAMKAR Mimika dibangun dengan **React 19**, **TypeScript**, **Tailwind CSS**, dan **shadcn/ui**, menggunakan build system native dari **Bun**.

## Persyaratan
- [Bun](https://bun.sh) (v1.2+)

## Skrip yang Tersedia

Jalankan perintah berikut di dalam direktori `frontend`:

### `bun dev` (atau `bun run dev`)
Menjalankan server frontend di port 3000 dengan Hot Module Replacement (HMR) dan proxy otomatis untuk endpoint API (`/api/*`) ke backend FastAPI (port 8001 secara default).

Buka [http://localhost:3000](http://localhost:3000) di browser.

### `bun run build`
Melakukan bundling dan optimasi aplikasi frontend ke folder `dist` menggunakan bundler native Bun (`Bun.build`).

### `bun start` (atau `bun run start`)
Menjalankan server production di mode `NODE_ENV=production`.

### `bun run typecheck`
Menjalankan pengecekan tipe statis TypeScript (`tsc --noEmit`) tanpa menghasilkan artefak build.

## Struktur Direktori
- `src/index.ts`: Server entrypoint Bun (HTTP server + API proxy + HMR)
- `src/index.html`: Entry point HTML tunggal (SPA)
- `src/frontend.tsx`: Client-side React root mounting
- `src/App.tsx`: Definisi routing dan layout utama
- `src/components/`: Komponen antarmuka dan UI (shadcn/ui)
- `src/pages/`: Halaman-halaman aplikasi
- `build.ts`: Skrip bundling native Bun untuk production build
- `bunfig.toml`: Konfigurasi runtime & plugin Bun
- `tsconfig.json`: Konfigurasi TypeScript untuk Bun
