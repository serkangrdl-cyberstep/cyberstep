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
import { Loader2, ShieldCheck, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

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
  const { lang } = useLanguage();
  const referralCode = new URLSearchParams(window.location.search).get("ref") ?? undefined;

  usePageMeta({
    title: lang === "en" ? "Start Free Assessment | CyberStep.io" : "Ucretsiz Degerlendirme Basla | CyberStep.io",
    description: lang === "en"
      ? "Enter your company details, complete the 20-question Mini Assessment and receive your personalized cybersecurity report."
      : "Sirket bilgilerinizi girin, 20 soruluk Mini Degerlendirmeyi tamamlayin ve kisisellestirilmis siber guvenlik raporunuzu alin.",
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
        onError: () => {
          toast({
            title: lang === "en" ? "Error" : "Hata",
            description: lang === "en" ? "An error occurred while starting the assessment." : "Değerlendirme başlatılırken bir hata oluştu.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {lang === "en" ? "Free Cybersecurity Analysis" : "Ücretsiz Siber Güvenlik Analizi"}
        </h1>
        <p className="text-muted-foreground">
          {lang === "en"
            ? "Fill in the details to assess your company's cybersecurity posture."
            : "Şirketinizin siber güvenlik durumunu öğrenmek için bilgileri doldurun."}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{lang === "en" ? "Company Information" : "Şirket Bilgileri"}</CardTitle>
              <CardDescription>
                {lang === "en"
                  ? "Basic company information needed to prepare your report."
                  : "Raporunuzun hazırlanabilmesi için temel şirket bilgileri."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{lang === "en" ? "Company Name" : "Şirket Adı"}</FormLabel>
                      <FormControl>
                        <Input placeholder={lang === "en" ? "e.g. Acme Ltd." : "Örn: Acme A.Ş."} {...field} />
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
                      <FormLabel>{lang === "en" ? "Sector" : "Sektör"}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={lang === "en" ? "Select sector" : "Sektör seçin"} />
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
                      <FormLabel>{lang === "en" ? "Contact Person" : "Yetkili Kişi"}</FormLabel>
                      <FormControl>
                        <Input placeholder={lang === "en" ? "Full Name" : "Ad Soyad"} {...field} />
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
                      <FormLabel>{lang === "en" ? "Employee Count" : "Çalışan Sayısı"}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={lang === "en" ? "Employee count" : "Çalışan sayısı"} />
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
                      <FormLabel>{lang === "en" ? "Email Address" : "E-posta Adresi"}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="example@company.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        {lang === "en"
                          ? "Your report can be sent to this address."
                          : "Raporunuz bu adrese gönderilebilir."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{lang === "en" ? "Phone (Optional)" : "Telefon (İsteğe bağlı)"}</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+90 555 555 55 55" {...field} />
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
                      <FormLabel>{lang === "en" ? "Web Domain (Optional)" : "Web Alan Adı (İsteğe bağlı)"}</FormLabel>
                      <FormControl>
                        <Input placeholder="yourcompany.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        {lang === "en"
                          ? "If provided, your domain's email and SSL security will also be scanned."
                          : "Girerseniz alan adınızın e-posta ve SSL güvenliği de taranır."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{lang === "en" ? "Assessment Type" : "Değerlendirme Tipi"}</CardTitle>
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
                              <span className="font-semibold text-lg">
                                {lang === "en" ? "Free Mini Analysis" : "Ücretsiz Mini Analiz"}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {lang === "en" ? "20 Critical Questions" : "20 Kritik Soru"}
                              </span>
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
                              <span className="font-semibold text-lg">
                                {lang === "en" ? "Comprehensive Analysis" : "Kapsamlı Analiz"}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {lang === "en" ? "55 Detailed Questions" : "55 Detaylı Soru"}
                              </span>
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
                  {lang === "en" ? "Starting..." : "Başlatılıyor..."}
                </>
              ) : (
                lang === "en" ? "Start Assessment" : "Değerlendirmeye Başla"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
