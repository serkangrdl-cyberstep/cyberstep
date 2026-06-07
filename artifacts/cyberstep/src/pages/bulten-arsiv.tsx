import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/language-context";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface BulletinSummary {
  id: number;
  weekNumber: number;
  year: number;
  weekSlug: string;
  headline: string | null;
  introText: string | null;
  sentAt: string | null;
  recipientCount: number;
}

export default function BulletinArchivePage() {
  const { lang } = useLanguage();
  const { data: bulletins = [], isLoading } = useQuery<BulletinSummary[]>({
    queryKey: ["bulletin-archive"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/bulletin/archive`);
      return r.json();
    },
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
          <h1 className="text-3xl font-bold text-[#E8EDF5]">{lang === "en" ? "Weekly Bulletin Archive" : "Haftalık Bülten Arsivi"}</h1>
          <p className="text-[#A8B8D0] mt-2">Her hafta Cuma, Türkiye'nin siber güvenlik gündemine dair istihbarat özeti.</p>
        </div>

        {isLoading && (
          <div className="text-[#5A6A80] text-center py-16">Yükleniyor...</div>
        )}

        <div className="space-y-3">
          {bulletins.map(b => (
            <Link key={b.id} href={`/bulten/${b.weekSlug}`}>
              <div className="block bg-[#060D1A] border border-[#111F35] rounded-xl p-5 hover:border-[#00C8FF]/40 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-[#00C8FF] font-bold uppercase tracking-widest mb-1">
                      Hafta {b.weekNumber} / {b.year}
                    </div>
                    <div className="text-[#E8EDF5] font-semibold leading-tight">
                      {b.headline ?? "—"}
                    </div>
                    {b.introText && (
                      <p className="text-[#7B8FAF] text-sm mt-2 line-clamp-2">{b.introText}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-[#5A6A80] whitespace-nowrap flex-shrink-0">
                    {b.sentAt ? new Date(b.sentAt).toLocaleDateString("tr-TR") : "—"}
                    <div className="mt-1">{b.recipientCount} alici</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!isLoading && bulletins.length === 0 && (
          <div className="text-center py-16 text-[#5A6A80]">Henüz gönderilmiş bülten yok.</div>
        )}

        <div className="mt-12 p-6 bg-[#060D1A] border border-[#1A2A40] rounded-xl text-center">
          <div className="text-[#E8EDF5] font-semibold mb-1">Haftalık bültene abone olun</div>
          <p className="text-[#7B8FAF] text-sm mb-4">Her Cuma gelen kutunuza gelsin.</p>
          <form
            onSubmit={async e => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget as HTMLFormElement);
              const email = fd.get("email") as string;
              if (!email) return;
              await fetch(`${BASE}/api/bulletin/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, source: "archive_page" }),
              });
              (e.target as HTMLFormElement).reset();
              alert("Abone oldunuz. Hos geldiniz!");
            }}
            className="flex gap-2 max-w-sm mx-auto"
          >
            <input
              name="email"
              type="email"
              placeholder="ornek@sirket.com.tr"
              required
              className="flex-1 bg-[#0A1020] border border-[#1A2A40] rounded-lg px-3 py-2 text-sm text-[#E8EDF5] placeholder:text-[#5A6A80] focus:outline-none focus:border-[#00C8FF]"
            />
            <button
              type="submit"
              className="bg-[#00C8FF] text-[#060D1A] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#00A8D8] transition-colors"
            >
              Abone Ol
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
