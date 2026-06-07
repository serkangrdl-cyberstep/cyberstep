import { useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useCreateAssessment } from "@workspace/api-client-react";
import { useCustomer } from "@/hooks/use-customer";
import { SECTORS, EMPLOYEE_COUNTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, CheckCircle2, Clock, Award, Lock, Plus, X, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";

const formSchema = z.object({
  companyName: z.string().min(2, "Şirket adı en az 2 karakter olmalıdır"),
  contactName: z.string().min(2, "İletişim adı en az 2 karakter olmalıdır"),
  contactEmail: z.string().email("Geçerli bir e-posta adresi girin"),
  sector: z.string().min(1, "Sektör seçiniz"),
  employeeCount: z.string().min(1, "Çalışan sayısı seçiniz"),
});

type FormValues = z.infer<typeof formSchema>;

const FULL_FEATURES = [
  { icon: CheckCircle2, text: "55 kapsamlı soru, 10 güvenlik alanı" },
  { icon: Clock, text: "Yaklaşık 15-20 dakika" },
  { icon: Award, text: "PDF rapor + uzman danışmanlık görüşmesi" },
  { icon: Shield, text: "KVKK uyumluluk değerlendirmesi dahil" },
];

export default function FullAssessmentStart() {
  const { lang } = useLanguage();
  const [, setLocation] = useLocation();
  const createAssessment = useCreateAssessment();
  const { data: customer, isLoading: customerLoading, isError: customerError } = useCustomer();
  const [domains, setDomains] = useState<string[]>([""]);

  const isPaidSubscriber =
    !!customer &&
    (customer.subscriptionPlan === "full" || customer.subscriptionPlan === "premium") &&
    customer.subscriptionStatus === "active";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      contactEmail: customer?.email ?? "",
      sector: "",
      employeeCount: "",
    },
  });

  const addDomain = () => setDomains(d => [...d, ""]);
  const removeDomain = (i: number) => setDomains(d => d.filter((_, idx) => idx !== i));
  const updateDomain = (i: number, val: string) =>
    setDomains(d => d.map((v, idx) => (idx === i ? val : v)));

  const onSubmit = async (values: FormValues) => {
    if (!isPaidSubscriber) return;
    try {
      const result = await createAssessment.mutateAsync({
        data: {
          companyName: values.companyName,
          contactName: values.contactName,
          email: values.contactEmail,
          sector: values.sector,
          employeeCount: values.employeeCount,
          assessmentType: "full",
        },
      });
      const assessmentId = (result as any).id;
      // Alan adı taramalarını arka planda başlat (fire and forget)
      const validDomains = domains.map(d => d.trim()).filter(d => d.length >= 3);
      for (const domain of validDomains) {
        fetch("/api/domain-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, email: values.contactEmail, referralSource: "full-assessment" }),
        }).catch(() => {});
      }
      setLocation(`/assessment/full/${assessmentId}`);
    } catch {
      form.setError("root", { message: "Bir hata oluştu. Lütfen tekrar deneyin." });
    }
  };

  // Yükleniyor
  if (customerLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Giriş yapılmamış
  if (customerError || !customer) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">{lang === "en" ? "Login Required" : "Giriş Gerekli"}</h2>
        <p className="text-muted-foreground mb-6">{lang === "en" ? "You need to log in to your account to use the comprehensive analysis." : "Kapsamlı analizi kullanmak için hesabınıza giriş yapmanız gerekiyor."}</p>
        <Button onClick={() => setLocation("/giris")} className="w-full">{lang === "en" ? "Log In" : "Giriş Yap"}</Button>
      </div>
    );
  }

  // Abonelik yok
  if (!isPaidSubscriber) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">{lang === "en" ? "Full Plan Required" : "Full Plan Gerekli"}</h2>
        <p className="text-muted-foreground mb-6">
          {lang === "en" ? "The 60-question Comprehensive Analysis is available to Full Plan subscribers only." : "60 soruluk Kapsamlı Analiz yalnızca Full Plan abonelerine açıktır."}
        </p>
        <Button onClick={() => setLocation("/fiyatlar")} className="w-full">{lang === "en" ? "See Plans" : "Planları Gör"}</Button>
        <Button variant="outline" onClick={() => setLocation("/assessment/start")} className="w-full mt-3">
          {lang === "en" ? "Try Free Mini Analysis" : "Ücretsiz Mini Analiz Yap"}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="text-center mb-10">
        <Badge className="bg-primary/10 text-primary border-primary/20 mb-3">{lang === "en" ? "Full Assessment" : "Tam Değerlendirme"}</Badge>
        <h1 className="text-3xl font-bold tracking-tight mb-3">{lang === "en" ? "Enter Your Company Details" : "Firma Bilgilerinizi Girin"}</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          {lang === "en" ? "Fill in basic information about your company before starting the 60-question comprehensive assessment." : "60 soruluk kapsamlı değerlendirmeye başlamadan önce şirketinizle ilgili temel bilgileri doldurun."}
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        <div className="md:col-span-2 space-y-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Tam Değerlendirme İçeriği
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {FULL_FEATURES.map((f) => (
                <div key={f.text} className="flex items-start gap-2.5 text-sm">
                  <f.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{f.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
              Verdiğiniz cevaplar gizlidir ve yalnızca size özel rapor oluşturmak için kullanılır.
              KVKK kapsamında kişisel verileriniz işlenmektedir.
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-3">
          <Card className="shadow-sm border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>Firma Bilgileri</CardTitle>
              <CardDescription>Tüm alanlar zorunludur.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Şirket Adı</FormLabel>
                        <FormControl>
                          <Input placeholder="Şirketinizin ticari adı" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Yetkili Ad Soyad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ad Soyad" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-posta Adresi</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@sirketiniz.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sector"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sektör</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seçin" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SECTORS.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="employeeCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Çalışan Sayısı</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seçin" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {EMPLOYEE_COUNTS.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Alan Adı Güvenlik Taraması */}
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Globe className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Alan Adı Güvenlik Taraması</span>
                        <Badge variant="outline" className="text-xs">İsteğe Bağlı</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Firmanıza ait alan adlarını girin. Her alan adı için e-posta, SSL ve DNS güvenlik taraması otomatik başlatılır.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {domains.map((domain, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            placeholder={`Ör: sirketiniz.com`}
                            value={domain}
                            onChange={e => updateDomain(i, e.target.value)}
                            className="flex-1 text-sm"
                          />
                          {domains.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDomain(i)}
                              className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addDomain}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Alan Adı Ekle
                    </button>
                  </div>

                  {form.formState.errors.root && (
                    <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-base"
                    disabled={createAssessment.isPending}
                  >
                    {createAssessment.isPending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Shield className="mr-2 h-5 w-5" />
                    )}
                    Tam Değerlendirmeye Başla
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
