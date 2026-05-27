import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRequireAdmin } from "@/hooks/use-admin";

const MINI_QUESTIONS = [
  { number: 1, domain: "Firma ve Yönetişim", weight: 1, isRedAlarm: false, text: "Şirketinizde siber güvenlikten ana sorumlu bir kişi veya rol net olarak tanımlı mı?" },
  { number: 2, domain: "Firma ve Yönetişim", weight: 1, isRedAlarm: false, text: "Kritik iş uygulamalarınızın ve temel sistemlerinizin listesi güncel olarak mevcut mu?" },
  { number: 3, domain: "Firma ve Yönetişim", weight: 2, isRedAlarm: true, text: "Yeni işe giren ve işten ayrılan çalışanlar için kullanıcı hesabı açma/kapama süreci tanımlı mı?" },
  { number: 4, domain: "Firma ve Yönetişim", weight: 1, isRedAlarm: false, text: "Şirketinizde hassas bilgilerin hangi sistemlerde tutulduğu güncel bir envanterle takip ediliyor mu?" },
  { number: 5, domain: "Kimlik ve Erişim", weight: 2, isRedAlarm: true, text: "Çalışanlar e-posta ve iş uygulamalarına girerken MFA/2FA kullanıyor mu?" },
  { number: 6, domain: "Kimlik ve Erişim", weight: 2, isRedAlarm: true, text: "Uzak erişim, VPN, yönetici yetkili hesaplarda ek doğrulama zorunlu mu?" },
  { number: 7, domain: "Kimlik ve Erişim", weight: 2, isRedAlarm: true, text: "İşten ayrılan çalışanların sistem erişimleri aynı gün kaldırılıyor mu?" },
  { number: 8, domain: "Kimlik ve Erişim", weight: 1, isRedAlarm: false, text: "Aynı kullanıcı hesabının birden fazla kişi tarafından kullanımı engelleniyor mu?" },
  { number: 9, domain: "E-posta ve İnsan Faktörü", weight: 1, isRedAlarm: false, text: "Çalışanlara şüpheli e-posta ve parola hırsızlığı riskleri hakkında farkındalık eğitimi veriliyor mu?" },
  { number: 10, domain: "E-posta ve İnsan Faktörü", weight: 1, isRedAlarm: false, text: "Şüpheli e-posta geldiğinde çalışanların bunu kime bildireceği biliniyor mu?" },
  { number: 11, domain: "E-posta ve İnsan Faktörü", weight: 2, isRedAlarm: true, text: "IBAN değişikliği veya acil para transferi gibi durumlarda e-posta dışında ikinci doğrulama uygulanıyor mu?" },
  { number: 12, domain: "E-posta ve İnsan Faktörü", weight: 2, isRedAlarm: true, text: "E-posta alan adınız üzerinden sahte mail gönderilmesini engelleyecek (SPF, DKIM, DMARC) yapılandırmalar devrede mi?" },
  { number: 13, domain: "Cihaz Güvenliği", weight: 1, isRedAlarm: false, text: "Şirkette kullanılan bilgisayarların güncel bir listesi tutuluyor mu?" },
  { number: 14, domain: "Cihaz Güvenliği", weight: 2, isRedAlarm: true, text: "Çalışan bilgisayarlarında zararlı yazılımlara karşı merkezi bir güvenlik çözümü bulunuyor mu?" },
  { number: 15, domain: "Cihaz Güvenliği", weight: 1, isRedAlarm: false, text: "Bilgisayarlar ve iş uygulamaları düzenli olarak güncelleniyor mu?" },
  { number: 16, domain: "Cihaz Güvenliği", weight: 1, isRedAlarm: false, text: "Dizüstü veya mobil cihazlarda ekran kilidi ve güçlü parola uygulanıyor mu?" },
  { number: 17, domain: "Veri Koruma ve Yedekleme", weight: 2, isRedAlarm: true, text: "Kritik verileriniz düzenli olarak (tercihen otomatik) yedekleniyor mu?" },
  { number: 18, domain: "Veri Koruma ve Yedekleme", weight: 2, isRedAlarm: true, text: "Alınan yedeklerin geri yüklenip çalışabildiği son 12 ayda test edildi mi?" },
  { number: 19, domain: "Veri Koruma ve Yedekleme", weight: 1, isRedAlarm: false, text: "Bir siber olay yaşanırsa ilk kimin devreye gireceği ve ne yapılacağı yazılı olarak belli mi?" },
  { number: 20, domain: "Veri Koruma ve Yedekleme", weight: 1, isRedAlarm: false, text: "Hassas dosyalara kimlerin erişebildiği düzenli olarak kontrol ediliyor mu?" },
];

const DOMAINS = [...new Set(MINI_QUESTIONS.map(q => q.domain))];

export default function AdminQuestions() {
  const [, navigate] = useLocation();
  const [openDomain, setOpenDomain] = useState<string | null>(DOMAINS[0] ?? null);
  useRequireAdmin();

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6 px-2">
          <Shield className="h-5 w-5 text-emerald-500" />
          <span className="font-bold text-white text-sm">CyberStep Admin</span>
        </div>
        <Button variant="ghost" className="justify-start text-slate-300 hover:text-white" onClick={() => navigate("/panel")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Genel Bakış
        </Button>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4">
          <h1 className="text-xl font-bold text-white">Soru Yönetimi</h1>
          <p className="text-slate-400 text-sm">Mini Assessment soruları — 20 soru, 5 alan</p>
        </header>

        <div className="p-8 max-w-4xl space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-300 text-sm flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>Soru metinleri şu an görüntüleme modundadır. Sorular backend kodunda tanımlıdır; değişiklik için kaynak kodu düzenlenmesi gerekir. Bu ekran mevcut soruları referans olarak gösterir.</div>
          </div>

          {DOMAINS.map(domain => {
            const qs = MINI_QUESTIONS.filter(q => q.domain === domain);
            const isOpen = openDomain === domain;
            return (
              <Card key={domain} className="bg-slate-800 border-slate-700 overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-750 transition-colors" onClick={() => setOpenDomain(isOpen ? null : domain)}>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{domain}</span>
                    <Badge className="bg-slate-700 text-slate-300">{qs.length} soru</Badge>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{qs.filter(q => q.isRedAlarm).length} alarm</Badge>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {isOpen && (
                  <CardContent className="border-t border-slate-700 divide-y divide-slate-700/50 p-0">
                    {qs.map(q => (
                      <div key={q.number} className="px-6 py-4 flex items-start gap-4">
                        <span className="text-slate-500 text-sm w-6 flex-shrink-0 pt-0.5">{q.number}.</span>
                        <div className="flex-1 text-slate-200 text-sm">{q.text}</div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {q.weight === 2 && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">Kritik x2</Badge>}
                          {q.isRedAlarm && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Alarm</Badge>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
