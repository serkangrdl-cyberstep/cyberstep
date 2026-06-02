import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface BulletinDetail {
  id: number;
  weekNumber: number;
  year: number;
  weekSlug: string;
  headline: string | null;
  introText: string | null;
  threatRadar: string | null;
  turkeyData: string | null;
  regulationSection: string | null;
  weeklyTip: string | null;
  toolResource: string | null;
  sentAt: string | null;
}

const SECTIONS = [
  { key: "threatRadar" as const, emoji: "🚨", title: "Tehdit Radarında", color: "#FF4560" },
  { key: "turkeyData" as const, emoji: "📊", title: "Türkiye Verisi",    color: "#00C8FF" },
  { key: "regulationSection" as const, emoji: "⚖️", title: "Mevzuat",   color: "#FFB020" },
  { key: "weeklyTip" as const, emoji: "✅", title: "Bu Hafta Yapın",    color: "#00E096" },
  { key: "toolResource" as const, emoji: "🔧", title: "Araç / Kaynak",  color: "#A78BFA" },
];

export default function BulletinDetailPage() {
  const [, params] = useRoute("/bulten/:slug");
  const slug = params?.slug ?? "";

  const { data: bulletin, isLoading, isError } = useQuery<BulletinDetail>({
    queryKey: ["bulletin-detail", slug],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/bulletin/${slug}`);
      if (!r.ok) throw new Error("Bulunamadi");
      return r.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1020] flex items-center justify-center text-[#5A6A80]">
        Yükleniyor...
      </div>
    );
  }

  if (isError || !bulletin) {
    return (
      <div className="min-h-screen bg-[#0A1020] flex flex-col items-center justify-center gap-4">
        <div className="text-[#E8EDF5] font-bold text-xl">Bülten bulunamadi</div>
        <Link href="/bulten/arsiv" className="text-[#00C8FF] text-sm hover:underline">
          Arsive dön
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1020] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-[#060D1A] border-b-2 border-[#00C8FF] rounded-t-2xl p-8 mb-0.5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#E8EDF5]">Cyber</span>
              <span className="text-xl font-black text-[#00C8FF]">Step</span>
              <span className="text-xs text-[#7B8FAF]">.io</span>
            </div>
            <span className="text-xs text-[#5A6A80]">
              Haftalik Istihbarat | Hafta {bulletin.weekNumber}/{bulletin.year}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#E8EDF5] leading-tight mb-4">
            {bulletin.headline}
          </h1>

          {bulletin.introText && (
            <p className="text-[#A8B8D0] leading-relaxed border-l-2 border-[#00C8FF] pl-4 text-sm">
              {bulletin.introText}
            </p>
          )}
        </div>

        {/* Sections */}
        {SECTIONS.map(s => {
          const content = bulletin[s.key];
          if (!content) return null;
          return (
            <div key={s.key} className="bg-[#060D1A] p-6 mb-0.5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{s.emoji}</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: s.color }}>
                  {s.title}
                </span>
              </div>
              <p className="text-[#A8B8D0] text-sm leading-relaxed whitespace-pre-line">{content}</p>
            </div>
          );
        })}

        {/* Footer CTA */}
        <div className="bg-[#060D1A] rounded-b-2xl p-8 text-center border-t border-[#111F35]">
          <p className="text-[#A8B8D0] mb-4 text-sm">Sirketinizin risk skorunu ögreinin</p>
          <Link
            href="/"
            className="inline-block bg-[#00C8FF] text-[#060D1A] px-8 py-3 rounded-lg font-bold text-sm hover:bg-[#00A8D8] transition-colors"
          >
            Ücretsiz Domain Tarama
          </Link>
          <div className="mt-6 text-xs text-[#5A6A80]">
            <Link href="/bulten/arsiv" className="hover:text-[#A8B8D0] transition-colors">Bülten arsivi</Link>
            {" · "}
            {bulletin.sentAt && new Date(bulletin.sentAt).toLocaleDateString("tr-TR")}
          </div>
        </div>
      </div>
    </div>
  );
}
