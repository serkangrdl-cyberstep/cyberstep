import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SECTORS, EMPLOYEE_COUNTS } from "@/lib/constants";
import { useLanguage } from "@/contexts/language-context";

export default function AiAssessmentStart() {
  const { lang } = useLanguage();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    sector: "",
    employeeCount: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.email || !form.sector || !form.employeeCount) {
      toast({ title: "Eksik bilgi", description: "Lütfen tüm alanları doldurun.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai-assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Sunucu hatası");
      }
      const data = await res.json() as { id: number };
      navigate(`/ai-guvenlik/${data.id}/araclar`);
    } catch (err) {
      toast({
        title: "Hata",
        description: err instanceof Error ? err.message : "Bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {lang === "en" ? "AI Security Assessment" : "Yapay Zeka Güvenlik Değerlendirmesi"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {lang === "en" ? "Enter your company details to get started. No technical knowledge required." : "Şirket bilgilerinizi girerek başlayın. Teknik bilgi gerekmez."}
          </p>
        </div>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Şirket Bilgileri</CardTitle>
            <CardDescription>Rapor bu bilgilerle kişiselleştirilecek.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="companyName">Şirket Adı</Label>
                <Input
                  id="companyName"
                  placeholder="Örn: Yıldız Tekstil A.Ş."
                  value={form.companyName}
                  onChange={e => handleChange("companyName", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName">Ad Soyad</Label>
                <Input
                  id="contactName"
                  placeholder="Değerlendirmeyi yapan kişi"
                  value={form.contactName}
                  onChange={e => handleChange("contactName", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="rapor@sirketim.com"
                  value={form.email}
                  onChange={e => handleChange("email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">Sektör</Label>
                <Select value={form.sector} onValueChange={v => handleChange("sector", v)}>
                  <SelectTrigger id="sector">
                    <SelectValue placeholder="Sektörünüzü seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeCount">Çalışan Sayısı</Label>
                <Select value={form.employeeCount} onValueChange={v => handleChange("employeeCount", v)}>
                  <SelectTrigger id="employeeCount">
                    <SelectValue placeholder="Çalışan sayısını seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_COUNTS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                size="lg"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Oluşturuluyor...</>
                ) : (
                  "Devam — AI Araçlarını Seç"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-4">
          Bilgileriniz yalnızca değerlendirme raporunda kullanılır. Üçüncü taraflarla paylaşılmaz.
        </p>
      </div>
    </div>
  );
}
