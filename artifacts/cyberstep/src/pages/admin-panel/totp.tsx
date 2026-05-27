import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, LayoutDashboard, Settings, CreditCard,
  FileText, Users, ShieldCheck, ShieldOff, QrCode, KeyRound, CheckCircle2, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/hooks/use-admin";

export default function AdminTotp() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: admin, isLoading: adminLoading } = useRequireAdmin();

  const [step, setStep] = useState<"idle" | "setup" | "done">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const logoutMutation = useMutation({
    mutationFn: () => fetch("/api/admin-panel/auth/logout", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.clear(); navigate("/panel/giris"); },
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin-panel/auth/totp-setup", { method: "POST", credentials: "include" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json() as Promise<{ secret: string; qrDataUrl: string }>;
      }),
    onSuccess: (data) => {
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setStep("setup");
      setError(null);
    },
    onError: (e: Error) => {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (tok: string) =>
      fetch("/api/admin-panel/auth/totp-confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tok }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json();
      }),
    onSuccess: () => {
      setStep("done");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin-me"] });
      toast({ title: "2FA Aktif", description: "İki faktörlü doğrulama başarıyla etkinleştirildi." });
    },
    onError: (e: Error) => {
      setError(e.message);
    },
  });

  const disableMutation = useMutation({
    mutationFn: () =>
      fetch("/api/admin-panel/auth/totp-disable", {
        method: "POST",
        credentials: "include",
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json();
      }),
    onSuccess: () => {
      setStep("idle");
      setQrDataUrl(null);
      setSecret(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin-me"] });
      toast({ title: "2FA Devre Dışı", description: "İki faktörlü doğrulama kapatıldı." });
    },
    onError: (e: Error) => {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    },
  });

  const navItems = [
    { icon: LayoutDashboard, label: "Genel Bakış", href: "/panel" },
    { icon: FileText, label: "Değerlendirmeler", href: "/panel/degerlendiirmeler" },
    { icon: CreditCard, label: "Ödemeler", href: "/panel/odemeler" },
    { icon: Settings, label: "Site Ayarları", href: "/panel/ayarlar" },
    { icon: CreditCard, label: "Fiyatlandırma", href: "/panel/fiyatlar" },
    { icon: Users, label: "Soru Yönetimi", href: "/panel/sorular" },
    { icon: Shield, label: "2FA Güvenlik", href: "/panel/totp", active: true },
  ];

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Yükleniyor...</div>
      </div>
    );
  }

  const totpEnabled = admin?.totpEnabled ?? false;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-500" />
            <span className="font-bold text-white">CyberStep Admin</span>
          </div>
          <div className="text-slate-400 text-xs mt-1">{admin?.email}</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ icon: Icon, label, href, active }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                active
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4">
          <h1 className="text-xl font-bold text-white">İki Faktörlü Doğrulama (2FA)</h1>
          <p className="text-slate-400 text-sm">Admin hesabınızı TOTP ile koruyun</p>
        </header>

        <div className="p-8 max-w-2xl">
          {/* Current status card */}
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {totpEnabled ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-slate-400" />
                )}
                2FA Durumu
              </CardTitle>
              <CardDescription className="text-slate-400">
                İki faktörlü doğrulama, hesabınıza yetkisiz erişimi engeller.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    className={totpEnabled
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-700 text-slate-400 border-slate-600"}
                  >
                    {totpEnabled ? "Aktif" : "Pasif"}
                  </Badge>
                  <span className="text-slate-300 text-sm">
                    {totpEnabled ? "Hesabınız 2FA ile korunuyor" : "2FA henüz etkinleştirilmedi"}
                  </span>
                </div>
                {totpEnabled && step !== "done" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                    onClick={() => disableMutation.mutate()}
                    disabled={disableMutation.isPending}
                  >
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Devre Dışı Bırak
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Setup flow */}
          {step === "idle" && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-emerald-400" />
                  {totpEnabled ? "2FA'yı Sıfırla" : "2FA Kurulumu Başlat"}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {totpEnabled
                    ? "Yeni bir authenticator uygulaması bağlamak için 2FA'yı sıfırlayabilirsiniz."
                    : "Google Authenticator veya Authy gibi bir uygulama ile 2FA kurabilirsiniz."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                  <p className="text-slate-300 text-sm font-medium">Gereksinimler:</p>
                  <ul className="text-slate-400 text-sm space-y-1">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Google Authenticator, Authy veya uyumlu bir TOTP uygulaması</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Smartphone veya tablet</li>
                  </ul>
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setupMutation.mutate()}
                  disabled={setupMutation.isPending}
                >
                  {setupMutation.isPending ? "Hazırlanıyor..." : totpEnabled ? "Yeni QR Kod Oluştur" : "Kurulumu Başlat"}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "setup" && qrDataUrl && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-emerald-400" />
                  QR Kodu Tarayın
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Authenticator uygulamanızla aşağıdaki QR kodu tarayın, ardından gösterilen 6 haneli kodu girin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl">
                    <img src={qrDataUrl} alt="TOTP QR Code" className="w-48 h-48" />
                  </div>
                </div>

                {secret && (
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <p className="text-slate-400 text-xs mb-1">Manuel giriş için gizli anahtar:</p>
                    <code className="text-emerald-400 text-sm font-mono break-all">{secret}</code>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-slate-400" />
                    Doğrulama Kodu
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={token}
                    onChange={e => {
                      setToken(e.target.value.replace(/\D/g, ""));
                      setError(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 text-xl tracking-widest text-center outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  />
                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={() => { setStep("idle"); setQrDataUrl(null); setSecret(null); setToken(""); setError(null); }}
                  >
                    Geri
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      if (token.length === 6) confirmMutation.mutate(token);
                    }}
                    disabled={token.length !== 6 || confirmMutation.isPending}
                  >
                    {confirmMutation.isPending ? "Doğrulanıyor..." : "Doğrula ve Etkinleştir"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "done" && (
            <Card className="bg-slate-800 border-emerald-500/30">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="bg-emerald-500/10 p-5 rounded-full">
                  <ShieldCheck className="h-12 w-12 text-emerald-400" />
                </div>
                <h3 className="text-white text-xl font-bold">2FA Başarıyla Etkinleştirildi</h3>
                <p className="text-slate-400 text-sm max-w-sm">
                  Bundan sonra giriş yaparken şifrenizin yanı sıra authenticator uygulamanızdaki 6 haneli kodu da girmeniz gerekecek.
                </p>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
                  onClick={() => navigate("/panel")}
                >
                  Dashboard'a Dön
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
