import { useState } from "react";
import { Shield, Eye, EyeOff, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch("/api/admin-panel/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: "Hata", description: d.error, variant: "destructive" }); return; }
      if (d.requiresTotp) { setStep("totp"); }
      else { navigate("/panel"); }
    } finally { setLoading(false); }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch("/api/admin-panel/auth/totp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: totpCode }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: "Hata", description: d.error, variant: "destructive" }); return; }
      navigate("/panel");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-emerald-500" />
            <span className="text-2xl font-bold text-white">CyberStep.io</span>
          </div>
          <CardTitle className="text-white text-xl">
            {step === "credentials" ? "Admin Girişi" : "İki Faktörlü Doğrulama"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {step === "credentials"
              ? "Yönetim paneline erişmek için giriş yapın"
              : "Google Authenticator uygulamasındaki 6 haneli kodu girin"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {step === "credentials" ? (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">E-posta</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  placeholder="admin@sirket.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Şifre</Label>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white pr-10" required />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleTotp} className="space-y-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-4">
                <Lock className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totp" className="text-slate-300">Doğrulama Kodu</Label>
                <Input id="totp" type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="bg-slate-800 border-slate-700 text-white text-center text-2xl tracking-widest"
                  placeholder="000000" maxLength={6} required />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading || totpCode.length < 6}>
                {loading ? "Doğrulanıyor..." : "Doğrula ve Giriş Yap"}
              </Button>
              <button type="button" onClick={() => setStep("credentials")} className="w-full text-sm text-slate-400 hover:text-slate-200">
                Geri don
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
