import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface NewsItem {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  relevanceScore: string | null;
  isTurkeyRelated: boolean;
  isIncluded: boolean;
  weekYear: number | null;
  weekNumber: number | null;
}

interface NewsPage {
  items: NewsItem[];
  total: number;
  page: number;
  limit: number;
}

function apiFetch(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return fetch(`${base}${path}`).then((r) => r.json());
}

function getISOWeek(date: Date): { weekYear: number; weekNumber: number } {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNumber =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return { weekYear: d.getFullYear(), weekNumber };
}

export default function NewsFeed() {
  const [page, setPage] = useState(1);
  const { weekYear, weekNumber } = getISOWeek(new Date());
  const [filterWeek, setFilterWeek] = useState(`${weekYear}-${weekNumber}`);

  const [selYear, selWeek] = filterWeek.split("-").map(Number) as [number, number];

  const { data, isLoading } = useQuery<NewsPage>({
    queryKey: ["news", selYear, selWeek, page],
    queryFn: () =>
      apiFetch(`/api/digest/news?weekYear=${selYear}&weekNumber=${selWeek}&page=${page}&limit=30`),
  });

  const weekOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const w = getISOWeek(d);
    return { label: `${w.weekYear} / Hafta ${w.weekNumber}`, value: `${w.weekYear}-${w.weekNumber}` };
  });

  const totalPages = data ? Math.ceil(data.total / (data.limit || 30)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Haber Akisi</h1>
          <p className="text-muted-foreground text-sm mt-1">Turkiye ile ilgili siber guvenlik haberleri</p>
        </div>
        <select
          value={filterWeek}
          onChange={(e) => { setFilterWeek(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground"
        >
          {weekOptions.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-full mb-1" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg p-10 text-center">
          <p className="text-muted-foreground">Bu hafta icin haber bulunamadi.</p>
          <p className="text-sm text-muted-foreground mt-1">Pano'dan "Simdi Topla" butonuna tiklayin.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data?.items.map((item) => (
              <div key={item.id} className="bg-card border border-card-border rounded-lg p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2 flex-1"
                  >
                    {item.title}
                  </a>
                  {item.relevanceScore && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      Number(item.relevanceScore) >= 7
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : Number(item.relevanceScore) >= 4
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {Number(item.relevanceScore).toFixed(0)}/10
                    </span>
                  )}
                </div>
                {item.summary && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.summary}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {item.publishedAt && (
                    <span>{new Date(item.publishedAt).toLocaleDateString("tr-TR")}</span>
                  )}
                  {item.isIncluded && (
                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">Digest'e Dahil</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{data?.total ?? 0} haber bulundu</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-card border border-border rounded-md disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Onceki
              </button>
              <span className="px-3 py-1.5">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-card border border-border rounded-md disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Sonraki
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
