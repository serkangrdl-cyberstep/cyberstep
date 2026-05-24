import { useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useCreateAssessment } from "@workspace/api-client-react";
import { SECTORS, EMPLOYEE_COUNTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, CheckCircle2, Clock, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [, setLocation] = useLocation();
  const createAssessment = useCreateAssessment();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      contactEmail: "",
      sector: "",
      employeeCount: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
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
      setLocation(`/assessment/full/${(result as any).id}`);
    } catch {
      form.setError("root", { message: "Bir hata oluştu. Lütfen tekrar deneyin." });
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="text-center mb-10">
        <Badge className="bg-primary/10 text-primary border-primary/20 mb-3">Tam Değerlendirme</Badge>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Firma Bilgilerinizi Girin</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          55 soruluk kapsamlı değerlendirmeye başlamadan önce şirketinizle ilgili temel bilgileri doldurun.
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
