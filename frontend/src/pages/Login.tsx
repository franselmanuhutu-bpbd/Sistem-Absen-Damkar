import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) nav("/dashboard", { replace: true });
  }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      toast.success("Berhasil masuk");
      nav("/dashboard", { replace: true });
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-[#0F172A] p-12 text-white lg:flex overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1614945201491-b867f6031bdd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#0F172A]/80 to-red-950/60" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600">
            <Flame className="h-7 w-7" />
          </div>
          <div>
            <p className="font-heading text-xl font-extrabold leading-none">DAMKAR MIMIKA</p>
            <p className="text-xs text-slate-300 mt-1">Papua Tengah</p>
          </div>
        </div>
        <div className="relative">
          <h2 className="font-heading text-4xl font-extrabold leading-tight">
            Sistem Informasi<br />Absensi Harian
          </h2>
          <p className="mt-4 max-w-md text-slate-300">
            Administrasi absensi pegawai Pemadam Kebakaran berbasis regu, rekap bulanan &amp; periode,
            serta export laporan resmi BPBD Kabupaten Mimika.
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-sm text-slate-400">
          <ShieldCheck className="h-4 w-4" />
          Badan Penanggulangan Bencana Daerah — Kab. Mimika
        </div>
      </div>

      {/* Right form */}
      <div className="flex w-full items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white">
              <Flame className="h-6 w-6" />
            </div>
            <p className="font-heading text-lg font-extrabold">DAMKAR MIMIKA</p>
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Selamat Datang</h1>
          <p className="mt-1 text-sm text-slate-500">Masuk untuk mengelola absensi pegawai.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email"
                placeholder="nama@damkar.go.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              className="h-11 w-full bg-red-600 text-base font-semibold hover:bg-red-700"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
