import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useLanguage } from "@/contexts/language-context";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface DigestEntry {
  id: number;
  weekYear: number;
  weekNumber: number;
  contentSummary: string | null;
  approvedAt: string | null;
}

export default function HaftalikDigestPage() {
  const { lang } = useLanguage();

  usePageMeta({
    title: lang === "en" ? "CyberStep Weekly Digest" : "CyberStep Haftalık Digest",
    description: lang === "en"
      ? "Weekly cybersecurity news digest — AI-curated summaries of the most critical threats, vulnerabilities and incidents."
      : "Haftalık siber güvenlik haber özeti — en kritik tehditler, zafiyetler ve olayların yapay zeka destekli derlemesi.",
    canonicalPath: "/haftalik-digest",
  });

  const { data: digests = [], isLoading } = useQuery<DigestEntry[]>({
    queryKey: ["public-approved-digests"],
    queryFn: () => fetch(`${BASE}/api/digest/public-approved`).then(r => r.json()),
  });

  return (
    <div className="min-h-screen bg-[#0A1020] text-[#E8EDF5]">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-black text-[#E8EDF5]">Cyber</span>
            <span className="text-2xl font-black text-[#00C8FF]">Step</span>
            <span className="text-sm text-[#7B8FAF]">.io</span>
          </div>
          <h1 className="text-3xl font-bold text-[#E8EDF5]">
            {lang === "en" ? "Weekly Digest Archive" : "Haftalık Digest Arsivi"}
          </h1>
          <p className="text-[#A8B8D0] mt-2">
            {lang === "en"
              ? "AI-curated weekly summaries of the most important cybersecurity news."
              : "Her hafta en önemli siber güvenlik haberlerinin yapay zeka destekli özeti."}
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/haberler" className="text-sm text-[#00C8FF] hover:underline">
              {lang === "en" ? "Live news feed" : "Canli haber akisi"} →
            </Link>
            <Link href="/bulten/arsiv" className="text-sm text-[#7B8FAF] hover:text-[#A8B8D0] hover:underline">
              {lang === "en" ? "CISO Bulletin archive" : "CISO Bulten arsivi"} →
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-[#060D1A] border border-[#111F35] rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        <div className="space-y-3">
          {digests.map(d => (
            <div
              key={d.id}
              className="bg-[#060D1A] border border-[#111F35] rounded-xl p-5 hover:border-[#00C8FF]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#00C8FF] font-bold uppercase tracking-widest mb-2">
                    {d.weekYear} / {lang === "en" ? "Week" : "Hafta"} {d.weekNumber}
                  </div>
                  {d.contentSummary ? (
                    <p className="text-[#A8B8D0] text-sm leading-relaxed line-clamp-4 whitespace-pre-line">
                      {d.contentSummary}
                    </p>
                  ) : (
                    <p className="text-[#5A6A80] text-sm italic">
                      {lang === "en" ? "Summary not available." : "Ozet mevcut degil."}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-[#5A6A80] whitespace-nowrap flex-shrink-0">
                  {d.approvedAt ? new Date(d.approvedAt).toLocaleDateString("tr-TR") : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isLoading && digests.length === 0 && (
          <div className="text-center py-16 text-[#5A6A80]">
            <p className="text-lg font-medium">
              {lang === "en" ? "No digest published yet." : "Henuz yayinlanmis digest yok."}
            </p>
            <p className="text-sm mt-2">
              {lang === "en"
                ? "Check back next week."
                : "Haftalik haber ozeti yakininda burada gorunecek."}
            </p>
          </div>
        )}

        <div className="mt-12 border-t border-[#1A2A40] pt-8 text-center">
          <p className="text-[#7B8FAF] text-sm">
            {lang === "en"
              ? "For the live news feed with individual articles, visit "
              : "Tek tek haberleri canli takip etmek icin "}
            <Link href="/haberler" className="text-[#00C8FF] hover:underline">
              {lang === "en" ? "/haberler" : "Haberler sayfasini"}
            </Link>
            {lang === "en" ? "." : " ziyaret edin."}
          </p>
        </div>
      </div>
    </div>
  );
}
