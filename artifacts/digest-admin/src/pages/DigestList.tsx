import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Digest {
  id: number;
  weekYear: number;
  weekNumber: number;
  status: string;
  approvedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function apiFetch(path: string) {
  return fetch(path).then((r) => r.json());
}

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">Taslak</span>;
    case "approved":
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Onaylandi</span>;
    case "sent":
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">Gonderildi</span>;
    default:
      return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{status}</span>;
  }
}

export default function DigestList() {
  const [, navigate] = useLocation();

  const { data: digests = [], isLoading } = useQuery<Digest[]>({
    queryKey: ["digests"],
    queryFn: () => apiFetch("/api/digest/digests"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Digest Listesi</h1>
        <p className="text-muted-foreground text-sm mt-1">Olusturulan haftalik digestler</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : digests.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg p-10 text-center">
          <p className="text-muted-foreground">Henuz digest olusturulmamis.</p>
          <p className="text-sm text-muted-foreground mt-1">Pano'dan "Simdi Olustur" butonuna tiklayin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {digests.map((d) => (
            <div
              key={d.id}
              onClick={() => navigate(`/digest/${d.id}`)}
              className="bg-card border border-card-border rounded-lg p-4 cursor-pointer hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">
                    {d.weekYear} / Hafta {d.weekNumber}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>Olusturuldu: {new Date(d.createdAt).toLocaleDateString("tr-TR")}</span>
                    {d.approvedAt && <span>Onaylandi: {new Date(d.approvedAt).toLocaleDateString("tr-TR")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(d.status)}
                  <span className="text-muted-foreground text-sm">Duzenle &rarr;</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
