import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Shield, CheckCircle2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function getTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export default function SifreSifirla() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const token = getTokenFromUrl();

  // ─── İstek gönderme aşaması ───────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);

  const requestMutation = useMutation({
    mutationFn: async (e: string) => {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Hata");
      return j;
    },
    onSuccess: () => setRequested(true),
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  // ─── Yeni şifre belirleme aşaması ─────────────────────────────────────
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (password !== confirm) throw new Error("Şifreler eşleşmiyor");
      if (password.length < 8) throw new Error("Şifre en az 8 karakter olmalıdır");
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Hata");
      return j;
    },
    onSuccess: () => setResetDone(true),
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  // ─── Token ile gelen kullanıcı → Yeni şifre belirleme ekranı ──────────
  if (token) {
    if (resetDone) {
      return (
        <div className="min-h-screen bg-secondary flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md space-y-4 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-primary mb-6">
              <Shield className="h-7 w-7" />
              <span className="font-bold text-2xl text-white">CyberStep.io</span>
            </Link>
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-white font-bold text-lg mb-2">Şifreniz Güncellendi</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Yeni şifrenizle giriş yapabilirsiniz.
                </p>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => navigate("/giris")}
                >
                  Giriş Yap
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-primary mb-6">
              <Shield className="h-7 w-7" />
              <span className="font-bold text-2xl text-white">CyberStep.io</span>
            </Link>
            <h1 className="text-2xl font-bold text-white">Yeni Şifre Belirle</h1>
            <p className="text-muted-foreground mt-1">En az 8 karakter uzunluğunda bir şifre seçin</p>
          </div>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Şifre Sıfırla</CardTitle>
              <CardDescription className="text-slate-400">
                Hesabınız için yeni şifrenizi girin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Yeni Şifre</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Şifre Tekrar</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  />
                </div>
                {confirm && password !== confirm && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> Şifreler eşleşmiyor
                  </div>
                )}
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!password || !confirm || resetMutation.isPending}
                  onClick={() => resetMutation.mutate()}
                >
                  {resetMutation.isPending ? "Kaydediliyor..." : "Şifremi Güncelle"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-slate-400">
            <Link href="/giris" className="text-emerald-400 hover:text-emerald-300">
              Giriş sayfasına dön
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── E-posta girme ekranı ──────────────────────────────────────────────
  if (requested) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md space-y-4 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-primary mb-6">
            <Shield className="h-7 w-7" />
            <span className="font-bold text-2xl text-white">CyberStep.io</span>
          </Link>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-white font-bold text-lg mb-2">E-posta Gönderildi</h2>
              <p className="text-slate-400 text-sm">
                E-posta adresinizle kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.
                Gelen kutunuzu kontrol edin (spam klasörünü de kontrol etmeyi unutmayın).
              </p>
              <p className="text-slate-500 text-xs mt-4">Bağlantı 1 saat geçerlidir.</p>
            </CardContent>
          </Card>
          <p className="text-center text-sm text-slate-400">
            <Link href="/giris" className="text-emerald-400 hover:text-emerald-300">
              Giriş sayfasına dön
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-primary mb-6">
            <Shield className="h-7 w-7" />
            <span className="font-bold text-2xl text-white">CyberStep.io</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Şifremi Unuttum</h1>
          <p className="text-muted-foreground mt-1">E-posta adresinizi girin, size sıfırlama bağlantısı gönderelim</p>
        </div>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Şifre Sıfırlama</CardTitle>
            <CardDescription className="text-slate-400">
              Hesabınıza kayıtlı e-posta adresini girin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={e => { e.preventDefault(); requestMutation.mutate(email); }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">E-posta Adresi</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@sirketiniz.com"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!email || requestMutation.isPending}
              >
                {requestMutation.isPending ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400">
          <Link href="/giris" className="text-emerald-400 hover:text-emerald-300">
            Giriş sayfasına dön
          </Link>
        </p>
      </div>
    </div>
  );
}
