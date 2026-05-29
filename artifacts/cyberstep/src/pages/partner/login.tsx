import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Shield, Loader2, Building2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "IT Altyapı / MSP", "KVKK / Uyum Danışmanlığı", "Siber Sigorta",
  "Penetrasyon Testi", "E-posta Güvenliği", "Bulut / Hosting",
  "SOC / Güvenlik İzleme", "Eğitim / Farkındalık",
];

export default function PartnerLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reg, setReg] = useState({
    email: "", password: "", companyName: "", contactName: "",
    phone: "", website: "", description: "", categories: [] as string[],
  });
  const [regDone, setRegDone] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/partner-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Giriş başarısız");
      return data;
    },
    onSuccess: () => setLocation("/ortak"),
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/partner-auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(reg),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kayıt başarısız");
      return data;
    },
    onSuccess: () => setRegDone(true),
  });

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-emerald-500/10 rounded-full p-3 border border-emerald-500/20">
              <Shield className="h-7 w-7 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">CyberStep Partner Portalı</h1>
          <p className="text-slate-400 text-sm mt-1">İş ortağı hesabınıza giriş yapın</p>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="w-full bg-slate-800 border border-slate-700 mb-6">
            <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-slate-700 text-slate-300">Giriş</TabsTrigger>
            <TabsTrigger value="register" className="flex-1 data-[state=active]:bg-slate-700 text-slate-300">Partner Başvurusu</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">E-posta</Label>
                  <Input
                    type="email"
                    className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                    placeholder="firma@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Şifre</Label>
                  <Input
                    type="password"
                    className="bg-slate-800 border-slate-600 text-slate-100"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && loginMutation.mutate()}
                  />
                </div>
                {loginMutation.isError && (
                  <p className="text-red-400 text-xs">{(loginMutation.error as Error).message}</p>
                )}
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!email || !password || loginMutation.isPending}
                  onClick={() => loginMutation.mutate()}
                >
                  {loginMutation.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Giriş yapılıyor...</>
                    : <><ChevronRight className="h-4 w-4 mr-2" /> Giriş Yap</>
                  }
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            {regDone ? (
              <Card className="bg-slate-900 border-emerald-700/50">
                <CardContent className="p-6 text-center">
                  <div className="bg-emerald-500/10 rounded-full p-3 w-fit mx-auto mb-3 border border-emerald-500/20">
                    <Shield className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">Başvurunuz Alındı</h3>
                  <p className="text-slate-400 text-sm">
                    Ekibimiz başvurunuzu değerlendirip 1-2 iş günü içinde e-posta ile bilgilendirme yapacak.
                    Onay sonrası giriş yapabilirsiniz.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-slate-100 text-base">Partner Başvuru Formu</CardTitle>
                  <CardDescription className="text-slate-500 text-xs">
                    Başvurunuz incelendikten sonra onaylanacak. Onay için minimum 1 kategori seçin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">Firma Adı *</Label>
                      <Input className="bg-slate-800 border-slate-600 text-slate-100 text-sm" value={reg.companyName}
                        onChange={e => setReg(r => ({ ...r, companyName: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">Yetkili Adı *</Label>
                      <Input className="bg-slate-800 border-slate-600 text-slate-100 text-sm" value={reg.contactName}
                        onChange={e => setReg(r => ({ ...r, contactName: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">E-posta *</Label>
                      <Input type="email" className="bg-slate-800 border-slate-600 text-slate-100 text-sm" value={reg.email}
                        onChange={e => setReg(r => ({ ...r, email: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">Şifre *</Label>
                      <Input type="password" className="bg-slate-800 border-slate-600 text-slate-100 text-sm" value={reg.password}
                        onChange={e => setReg(r => ({ ...r, password: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">Telefon</Label>
                      <Input className="bg-slate-800 border-slate-600 text-slate-100 text-sm" value={reg.phone}
                        onChange={e => setReg(r => ({ ...r, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs">Web Sitesi</Label>
                      <Input className="bg-slate-800 border-slate-600 text-slate-100 text-sm" value={reg.website}
                        onChange={e => setReg(r => ({ ...r, website: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Uzmanlık Alanları *</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map(c => (
                        <button key={c} type="button"
                          className={`text-xs px-2 py-1 rounded border transition-colors ${reg.categories.includes(c) ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-600 text-slate-400 hover:border-slate-500"}`}
                          onClick={() => setReg(r => ({
                            ...r,
                            categories: r.categories.includes(c)
                              ? r.categories.filter(x => x !== c)
                              : [...r.categories, c],
                          }))}
                        >{c}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Firma Hakkında (isteğe bağlı)</Label>
                    <textarea
                      className="w-full bg-slate-800 border border-slate-600 text-slate-100 text-sm rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      rows={2}
                      value={reg.description}
                      onChange={e => setReg(r => ({ ...r, description: e.target.value }))}
                      placeholder="Firmanız ve uzmanlıklarınız hakkında kısa bilgi..."
                    />
                  </div>
                  {registerMutation.isError && (
                    <p className="text-red-400 text-xs">{(registerMutation.error as Error).message}</p>
                  )}
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!reg.email || !reg.password || !reg.companyName || !reg.contactName || reg.categories.length === 0 || registerMutation.isPending}
                    onClick={() => registerMutation.mutate()}
                  >
                    {registerMutation.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gönderiliyor...</>
                      : "Başvuruyu Gönder"
                    }
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-center text-slate-600 text-xs mt-6">
          <Link href="/" className="hover:text-slate-400 transition-colors">CyberStep.io ana sayfa</Link>
        </p>
      </div>
    </div>
  );
}
