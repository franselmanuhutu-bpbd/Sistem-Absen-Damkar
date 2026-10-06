import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import InputAbsensi from "@/pages/InputAbsensi";
import Kalender from "@/pages/Kalender";
import RekapBulanan from "@/pages/RekapBulanan";
import RekapPeriode from "@/pages/RekapPeriode";
import RekapKasubid from "@/pages/RekapKasubid";
import AbsensiSaya from "@/pages/AbsensiSaya";
import AbsensiKasubid from "@/pages/AbsensiKasubid";
import PengaturanKasubid from "@/pages/PengaturanKasubid";
import DataPegawai from "@/pages/DataPegawai";
import ManajemenRegu from "@/pages/ManajemenRegu";
import LaporanExport from "@/pages/LaporanExport";
import UserManagement from "@/pages/UserManagement";
import AuditLog from "@/pages/AuditLog";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading || user === null)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/input-absensi" element={<Protected roles={["admin", "operator"]}><InputAbsensi /></Protected>} />
          <Route path="/absensi-kasubid" element={<Protected roles={["admin", "operator"]}><AbsensiKasubid /></Protected>} />
          <Route path="/pengaturan-kasubid" element={<Protected roles={["admin"]}><PengaturanKasubid /></Protected>} />
          <Route path="/kalender" element={<Protected><Kalender /></Protected>} />
          <Route path="/rekap-bulanan" element={<Protected><RekapBulanan /></Protected>} />
          <Route path="/rekap-periode" element={<Protected><RekapPeriode /></Protected>} />
          <Route path="/rekap-kasubid" element={<Protected roles={["admin", "operator", "viewer", "kasubid"]}><RekapKasubid /></Protected>} />
          <Route path="/absensi-saya" element={<Protected roles={["staff", "kasubid", "komandan", "operator"]}><AbsensiSaya /></Protected>} />
          <Route path="/data-pegawai" element={<Protected roles={["admin", "operator"]}><DataPegawai /></Protected>} />
          <Route path="/manajemen-regu" element={<Protected roles={["admin", "operator"]}><ManajemenRegu /></Protected>} />
          <Route path="/laporan-export" element={<Protected><LaporanExport /></Protected>} />
          <Route path="/user-management" element={<Protected roles={["admin"]}><UserManagement /></Protected>} />
          <Route path="/audit-log" element={<Protected roles={["admin"]}><AuditLog /></Protected>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
