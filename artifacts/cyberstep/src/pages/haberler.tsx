import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Calendar, Globe, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

interface NewsItem {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  aiSummary: string | null;
  enrichedAt: string | null;
  category: string | null;
  publishedAt: string | null;
  isTurkeyRelated: boolean;
  weekYear: number | null;
  weekNumber: number | null;
}

interface NewsPage {
  items: NewsItem[];
  total: number;
  page: number;
  limit: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  cve_vulnerability: "CVE Zafiyeti",
  threat_intel: "Tehdit İstihbaratı",
  data_breach: "Veri İhlali",
  regulation_kvkk: "KVKK / Mevzuat",
  vendor_security: "Vendor Güvenlik",
  turkey_news: "Türkiye",
  sector_news: "Sektör",
  general: "Genel",
};

function getISOWeek(date: Date): { weekYear: number; weekNumber: number } {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNumber =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { weekYear: d.getFullYear(), weekNumber };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function NewsCard({ item }: { item: NewsItem }) {
  const [expanded, setExpanded] = useState(false);
  const displaySummary = item.aiSummary || item.summary;
  const isEnriched = !!item.aiSummary;
  const isLong = (displaySummary?.length ?? 0) > 120;

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-primary transition-colors leading-snug block mb-1.5"
          >
            {item.title}
          </a>

          {displaySummary && (
            <div>
              <p className={`text-muted-foreground text-sm leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
                {displaySummary}
              </p>
              {isLong && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                >
                  {expanded ? (
                    <><ChevronUp size={12} /> Daha az göster</>
                  ) : (
                    <><ChevronDown size={12} /> Devamını gör</>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {item.publishedAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                <Calendar size={11} />
                {formatDate(item.publishedAt)}
              </span>
            )}
            {item.category && CATEGORY_LABELS[item.category] && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                {CATEGORY_LABELS[item.category]}
              </span>
            )}
            {item.isTurkeyRelated && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Türkiye
              </span>
            )}
            {isEnriched && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20">
                <Sparkles size={10} />
                AI özet
              </span>
            )}
          </div>
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors mt-0.5"
          title="Habere git"
        >
          <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}

export default function Haberler() {
  usePageMeta({
    title: "Siber Güvenlik Haberleri | CyberStep.io",
    description: "Güncel siber güvenlik haberleri. Türkiye ve dünya genelindeki tehditler, zafiyet duyuruları ve sektörel gelişmeler.",
  });

  const [page, setPage] = useState(1);
  const { weekYear, weekNumber } = getISOWeek(new Date());
  const [filterWeek, setFilterWeek] = useState(`${weekYear}-${weekNumber}`);
  const [showAll, setShowAll] = useState(false);

  const [selYear, selWeek] = filterWeek.split("-").map(Number) as [number, number];

  const weekParams = showAll
    ? "turkeyOnly=false"
    : `weekYear=${selYear}&weekNumber=${selWeek}&turkeyOnly=false`;

  const { data, isLoading } = useQuery<NewsPage>({
    queryKey: ["public-news", selYear, selWeek, page, showAll],
    queryFn: () =>
      fetch(`/api/digest/news?${weekParams}&page=${page}&limit=20`).then((r) => r.json()),
  });

  const weekOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const w = getISOWeek(d);
    return { label: `${w.weekYear} / Hafta ${w.weekNumber}`, value: `${w.weekYear}-${w.weekNumber}` };
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Siber Güvenlik Haberleri</h1>
          <p className="text-muted-foreground">
            Güncel tehditler, zafiyet duyuruları ve sektörel gelişmeler
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <select
            value={filterWeek}
            onChange={(e) => { setFilterWeek(e.target.value); setPage(1); setShowAll(false); }}
            className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground"
          >
            {weekOptions.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
          <button
            onClick={() => { setShowAll(!showAll); setPage(1); }}
            className={`px-3 py-2 rounded-md text-sm border transition-colors ${
              showAll
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {showAll ? "Haftalık filtre" : "Tüm haberler"}
          </button>
          {data && (
            <span className="text-sm text-muted-foreground ml-auto">{data.total} haber</span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <Globe className="mx-auto mb-4 opacity-30" size={40} />
            <p className="text-lg font-medium">Bu hafta haber bulunamadı</p>
            <p className="text-sm mt-1">Farklı bir hafta seçin veya tüm haberler filtresini deneyin</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-card transition-colors"
            >
              Önceki
            </button>
            <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-card transition-colors"
            >
              Sonraki
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
