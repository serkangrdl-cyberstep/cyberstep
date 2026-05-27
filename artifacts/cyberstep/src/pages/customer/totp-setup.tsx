import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, QrCode, KeyRound, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRequireCustomer } from "@/hooks/use-customer";

export default function CustomerTotpSetup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  useRequireCustomer();

  const [step, setStep] = useState<"intro" | "setup" | "done">("intro");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setupMutation = useMutation({
    mutationFn: () =>
      fetch("/api/auth/totp-setup", { method: "POST", credentials: "include" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json() as Promise<{ secret: string; qrDataUrl: string }>;
      }),
    onSuccess: (data) => {
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setStep("setup");
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (tok: string) =>
      fetch("/api/auth/totp-confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tok }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-me"] });
      setStep("done");
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-primary mb-6">
            <Shield className="h-7 w-7" />
            <span className="font-bold text-2xl text-white">CyberStep.io</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">İki Faktörlü Doğrulama</h1>
          <p className="text-muted-foreground mt-1">Hesabınızı ekstra güvenlik katmanıyla koruyun</p>
        </div>

        {step === "intro" && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                2FA Kurulumu (İsteğe Bağlı)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Hesabınızı şifrenizin yanı sıra bir doğrulama koduyla da koruyabilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <p className="text-slate-300 text-sm font-medium">Gereksinimler:</p>
                <ul className="text-slate-400 text-sm space-y-1.5">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    Google Authenticator, Authy veya uyumlu TOTP uygulaması
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    Smartphone veya tablet
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setupMutation.mutate()}
                  disabled={setupMutation.isPending}
                >
                  {setupMutation.isPending ? "Hazırlanıyor..." : "2FA Kurulumunu Başlat"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-slate-200"
                  onClick={() => navigate("/hesabim")}
                >
                  Atla, Hesabıma Git <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "setup" && qrDataUrl && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-400" />
                QR Kodu Tarayın
              </CardTitle>
              <CardDescription className="text-slate-400">
                Authenticator uygulamanızla kodu tarayın, ardından gösterilen kodu girin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl">
                  <img src={qrDataUrl} alt="TOTP QR" className="w-44 h-44" />
                </div>
              </div>
              {secret && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Manuel giriş için gizli anahtar:</p>
                  <code className="text-emerald-400 text-xs font-mono break-all">{secret}</code>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-slate-400" /> Doğrulama Kodu
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={token}
                  onChange={e => { setToken(e.target.value.replace(/\D/g, "")); setError(null); }}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 text-xl tracking-widest text-center outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => { setStep("intro"); setQrDataUrl(null); setSecret(null); setToken(""); }}
                >
                  Geri
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => token.length === 6 && confirmMutation.mutate(token)}
                  disabled={token.length !== 6 || confirmMutation.isPending}
                >
                  {confirmMutation.isPending ? "Doğrulanıyor..." : "Etkinleştir"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "done" && (
          <Card className="bg-slate-900 border-emerald-500/30">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="bg-emerald-500/10 p-5 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
              <h3 className="text-white text-xl font-bold">2FA Başarıyla Etkinleştirildi</h3>
              <p className="text-slate-400 text-sm max-w-sm">
                Bundan sonra giriş yaparken authenticator uygulamanızdaki 6 haneli kodu girmeniz gerekecek.
              </p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
                onClick={() => navigate("/hesabim")}
              >
                Hesabıma Git <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
