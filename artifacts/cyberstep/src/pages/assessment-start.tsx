import { useState } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useCreateAssessment } from "@workspace/api-client-react";
import { SECTORS, EMPLOYEE_COUNTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  companyName: z.string().min(2, { message: "Şirket adı en az 2 karakter olmalıdır." }),
  contactName: z.string().min(2, { message: "Yetkili kişi adı en az 2 karakter olmalıdır." }),
  email: z.string().email({ message: "Geçerli bir e-posta adresi giriniz." }),
  phone: z.string().optional(),
  sector: z.string({ required_error: "Lütfen bir sektör seçiniz." }),
  employeeCount: z.string({ required_error: "Lütfen çalışan sayısını seçiniz." }),
  assessmentType: z.enum(["mini", "full"], { required_error: "Lütfen değerlendirme tipi seçiniz." }),
  companyDomain: z.string().optional(),
});

export default function AssessmentStart() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  // ?ref= parametresini yakala — referral tracking için assessment'a kaydedilir
  const referralCode = new URLSearchParams(window.location.search).get("ref") ?? undefined;

  usePageMeta({
    title: "Ucretsiz Degerlendirme Basla | CyberStep.io",
    description: "Sirket bilgilerinizi girin, 20 soruluk Mini Degerlendirmeyi tamamlayin ve kisisellestirilmis siber guvenlik raporunuzu alin.",
    noIndex: true,
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      sector: "",
      employeeCount: "",
      assessmentType: "mini",
      companyDomain: "",
    },
  });

  const createAssessment = useCreateAssessment();

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.assessmentType === "full") {
      setLocation("/assessment/full/start");
      return;
    }

    createAssessment.mutate(
      { data: { ...values, companyDomain: values.companyDomain?.trim() || null, referralCode: referralCode ?? null } },
      {
        onSuccess: (data) => {
          setLocation(`/assessment/${data.id}`);
        },
        onError: (error) => {
          toast({
            title: "Hata",
            description: "Değerlendirme başlatılırken bir hata oluştu.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Ücretsiz Siber Güvenlik Analizi</h1>
        <p className="text-muted-foreground">Şirketinizin siber güvenlik durumunu öğrenmek için bilgileri doldurun.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Şirket Bilgileri</CardTitle>
              <CardDescription>Raporunuzun hazırlanabilmesi için temel işletme bilgileri.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şirket Adı</FormLabel>
                      <FormControl>
                        <Input placeholder="Örn: Acme A.Ş." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sektör</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sektör seçin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SECTORS.map((sector) => (
                            <SelectItem key={sector} value={sector}>
                              {sector}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yetkili Kişi</FormLabel>
                      <FormControl>
                        <Input placeholder="Ad Soyad" {...field} />
                      </FormControl>
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
                            <SelectValue placeholder="Çalışan sayısı" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EMPLOYEE_COUNTS.map((count) => (
                            <SelectItem key={count} value={count}>
                              {count}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-posta Adresi</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="ornek@sirket.com" {...field} />
                      </FormControl>
                      <FormDescription>Raporunuz bu adrese gönderilebilir.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon (İsteğe bağlı)</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="0555 555 55 55" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyDomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Web Alan Adı (İsteğe bağlı)</FormLabel>
                      <FormControl>
                        <Input placeholder="sirketiniz.com" {...field} />
                      </FormControl>
                      <FormDescription>Girerseniz alan adınızın e-posta ve SSL güvenliği de taranır.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Değerlendirme Tipi</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="assessmentType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem value="mini" className="peer sr-only" />
                          </FormControl>
                          <FormLabel className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <Zap className="mb-3 h-6 w-6 text-primary" />
                            <div className="flex flex-col items-center space-y-1">
                              <span className="font-semibold text-lg">Ücretsiz Mini Analiz</span>
                              <span className="text-sm text-muted-foreground">20 Kritik Soru</span>
                            </div>
                          </FormLabel>
                        </FormItem>
                        
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem value="full" className="peer sr-only" />
                          </FormControl>
                          <FormLabel className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer relative">
                            <ShieldCheck className="mb-3 h-6 w-6 text-primary" />
                            <div className="flex flex-col items-center space-y-1">
                              <span className="font-semibold text-lg">Kapsamlı Analiz</span>
                              <span className="text-sm text-muted-foreground">55 Detaylı Soru</span>
                            </div>
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={createAssessment.isPending} className="w-full md:w-auto h-12 px-8 text-lg">
              {createAssessment.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Başlatılıyor...
                </>
              ) : (
                "Değerlendirmeye Başla"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
