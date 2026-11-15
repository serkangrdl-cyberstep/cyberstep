/**
 * Fiyatlar — TPRM yıllık abonelik paketleri.
 * Önceki fiyat sayfası (servis kataloğu): pages/archive/pricing-legacy.tsx
 *
 * Fiyatlar ve limitler tek yerde: PLANS dizisi. Ücretli paketler şimdilik satış
 * ekibi üzerinden (teklif + yıllık fatura) satılır; CTA iletişim formuna gider.
 */
import { Link } from "wouter";
import { Check, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";
import { usePageMeta } from "@/hooks/use-page-meta";

interface Plan {
  id: string;
  name: { tr: string; en: string };
  /** Yıllık fiyat (TL, KDV hariç). null = teklif. 0 = ücretsiz. */
  yearlyTry: number | null;
  /** true ise fiyat "…'den başlayan" olarak gösterilir (kapsama göre artar). */
  fromPrice?: boolean;
  suppliers: { tr: string; en: string };
  audience: { tr: string; en: string };
  features: Array<{ tr: string; en: string }>;
  cta: { tr: string; en: string; href: string };
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "ucretsiz",
    name: { tr: "Ücretsiz", en: "Free" },
    yearlyTry: 0,
    suppliers: { tr: "5 tedarikçi", en: "5 suppliers" },
    audience: { tr: "Denemek isteyenler", en: "Getting started" },
    features: [
      { tr: "Anlık Risk Skoru v2", en: "Instant Risk Score v2" },
      { tr: "Haftalık otomatik yeniden tarama", en: "Weekly automatic rescans" },
      { tr: "Bulgu ve kategori kırılımı", en: "Findings and category breakdown" },
    ],
    cta: { tr: "Ücretsiz başla", en: "Start free", href: "/hesabim/tedarikci-portfoyu" },
  },
  {
    id: "baslangic",
    name: { tr: "Başlangıç", en: "Starter" },
    yearlyTry: 59000,
    suppliers: { tr: "25 tedarikçi", en: "25 suppliers" },
    audience: { tr: "KOBİ ve orta ölçekli şirketler", en: "SMEs and mid-market" },
    features: [
      { tr: "Ücretsiz paketteki her şey", en: "Everything in Free" },
      { tr: "CSV/Excel ile toplu yükleme", en: "Bulk upload via CSV/Excel" },
      { tr: "Kritik bulgu ve risk artışı uyarıları", en: "Critical finding and risk escalation alerts" },
      { tr: "Tedarikçi öz-değerlendirme anketi", en: "Supplier self-assessment questionnaire" },
      { tr: "Portföy PDF raporu (KVKK / 7545)", en: "Portfolio PDF report (KVKK / Law 7545)" },
    ],
    cta: { tr: "Teklif iste", en: "Request a quote", href: "/iletisim?konu=Tedarikçi Riski - Başlangıç paketi" },
  },
  {
    id: "profesyonel",
    name: { tr: "Profesyonel", en: "Professional" },
    yearlyTry: 149000,
    suppliers: { tr: "100 tedarikçi", en: "100 suppliers" },
    audience: { tr: "Kurumsal satın alma ve uyum ekipleri", en: "Procurement and compliance teams" },
    features: [
      { tr: "Başlangıç paketindeki her şey", en: "Everything in Starter" },
      { tr: "Sektör kıyaslaması ve yüzdelik dilim", en: "Sector benchmark and percentile" },
      { tr: "Yönetim kurulu özet raporu", en: "Board summary report" },
      { tr: "Öncelikli destek", en: "Priority support" },
    ],
    cta: { tr: "Teklif iste", en: "Request a quote", href: "/iletisim?konu=Tedarikçi Riski - Profesyonel paket" },
    highlight: true,
  },
  {
    id: "kurumsal",
    name: { tr: "Kurumsal", en: "Enterprise" },
    yearlyTry: 600000,
    fromPrice: true,
    suppliers: { tr: "500+ tedarikçi", en: "500+ suppliers" },
    audience: { tr: "Bankalar, holdingler, kamu", en: "Banks, holdings, public sector" },
    features: [
      { tr: "Profesyonel paketteki her şey", en: "Everything in Professional" },
      { tr: "Risk Skoru API erişimi", en: "Risk Score API access" },
      { tr: "BDDK destek hizmeti / DORA raporlama desteği", en: "BDDK support-service / DORA reporting support" },
      { tr: "Özel sözleşme ve SLA", en: "Custom contract and SLA" },
    ],
    cta: { tr: "Satış ekibiyle görüş", en: "Talk to sales", href: "/iletisim?konu=Tedarikçi Riski - Kurumsal paket" },
  },
];

export default function Pricing() {
  const { lang } = useLanguage();
  const en = lang === "en";
  const L = (v: { tr: string; en: string }) => (en ? v.en : v.tr);

  usePageMeta({
    title: en ? "Pricing — Supplier Cyber Risk | CyberStep.io" : "Fiyatlar — Tedarikçi Siber Risk | CyberStep.io",
    description: en
      ? "Annual plans for supplier cyber risk monitoring: free for 5 suppliers, Starter, Professional and Enterprise with API access."
      : "Tedarikçi siber risk izleme için yıllık paketler: 5 tedarikçiye kadar ücretsiz, Başlangıç, Profesyonel ve API erişimli Kurumsal.",
    canonicalPath: "/fiyatlar",
    lang,
  });

  const fmt = (n: number) => new Intl.NumberFormat(en ? "en-US" : "tr-TR").format(n);

  return (
    <div>
      <section className="py-14 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 max-w-3xl text-center space-y-3">
          <h1 className="text-4xl font-bold text-white">{en ? "Plans & pricing" : "Paketler ve fiyatlar"}</h1>
          <p className="text-white/75">
            {en
              ? "Annual subscriptions priced by the number of monitored suppliers: those whose cyber incident would affect your operations, such as API and data providers, production sub-suppliers, cloud services and data processors. Prices exclude VAT."
              : "İzlenen tedarikçi sayısına göre yıllık abonelik. Tedarikçi, siber olay yaşarsa operasyonunuzu etkileyecek firmadır: API ve veri sağlayıcıları, yan sanayi, bulut hizmetleri, veri işleyenler. Fiyatlara KDV dahil değildir."}
          </p>
        </div>
      </section>

      <section className="py-14 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`rounded-2xl border p-6 flex flex-col ${p.highlight ? "border-primary shadow-lg shadow-primary/10" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{L(p.name)}</h2>
                  {p.highlight && <Badge>{en ? "Most popular" : "En çok tercih edilen"}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{L(p.audience)}</p>

                <div className="mt-5">
                  {p.yearlyTry === null ? (
                    <p className="text-2xl font-bold">{en ? "Custom" : "Teklif ile"}</p>
                  ) : p.yearlyTry === 0 ? (
                    <p className="text-2xl font-bold">{en ? "Free" : "Ücretsiz"}</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">
                        {p.fromPrice && <span className="text-sm font-normal text-muted-foreground">{en ? "From " : ""}</span>}
                        {fmt(p.yearlyTry)} TL{p.fromPrice && !en ? "'den başlayan" : ""} <span className="text-sm font-normal text-muted-foreground">/ {en ? "year" : "yıl"}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.fromPrice
                          ? (en ? "Final price depends on supplier count and scope; annual contract" : "Nihai fiyat tedarikçi sayısı ve kapsama göre belirlenir; yıllık sözleşme")
                          : (en ? `≈ ${fmt(Math.round(p.yearlyTry / 12))} TL / month, billed annually` : `Aylık ≈ ${fmt(Math.round(p.yearlyTry / 12))} TL, yıllık faturalandırılır`)}
                      </p>
                    </>
                  )}
                  <p className="text-sm font-medium text-primary mt-2">{L(p.suppliers)}</p>
                </div>

                <ul className="mt-5 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f.tr} className="text-sm flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{L(f)}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.cta.href}
                  className={`mt-6 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 ${
                    p.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border hover:bg-muted"
                  }`}
                >
                  {en ? p.cta.en : p.cta.tr}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-10 grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border p-6">
              <h3 className="font-bold">{en ? "Risk Score API for insurers and banks" : "Sigortacılar ve bankalar için Risk Skoru API"}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                {en
                  ? "Query the score, findings and sector benchmark of any Turkish domain from your own systems. Usage-based pricing."
                  : "Herhangi bir Türk alan adının skorunu, bulgularını ve sektör kıyaslamasını kendi sistemlerinizden sorgulayın. Kullanım bazlı fiyatlandırma."}
              </p>
              <div className="flex gap-3 mt-4 text-sm">
                <Link href="/skor-api" className="text-primary font-medium hover:underline">{en ? "API details" : "API detayları"} →</Link>
                <Link href="/iletisim?konu=Risk Skoru API" className="text-primary font-medium hover:underline">{en ? "Request access" : "Erişim talep et"} →</Link>
              </div>
            </div>
            <div className="rounded-2xl border p-6">
              <h3 className="font-bold">{en ? "Free tools stay free" : "Ücretsiz araçlar ücretsiz kalıyor"}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                {en
                  ? "Domain scan, DMARC/SSL checks, dark web lookup, the SME risk assessment and KVKK tools are free."
                  : "Alan adı taraması, DMARC/SSL kontrolü, dark web sorgulama, KOBİ risk değerlendirmesi ve KVKK araçları ücretsizdir."}
              </p>
              <div className="flex gap-3 mt-4 text-sm">
                <Link href="/araclar" className="text-primary font-medium hover:underline">{en ? "All tools" : "Tüm araçlar"} →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
