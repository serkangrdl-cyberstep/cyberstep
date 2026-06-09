import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useCallback, useRef, useEffect } from "react";

interface Digest {
  id: number;
  weekYear: number;
  weekNumber: number;
  status: string;
  contentSummary: string | null;
  contentLinkedin: string | null;
  contentTwitter: string | null;
  contentInstagram: string | null;
  contentStory: string | null;
  approvedAt: string | null;
}

const TABS = [
  { key: "contentSummary", label: "Ozet" },
  { key: "contentLinkedin", label: "LinkedIn" },
  { key: "contentTwitter", label: "Twitter" },
  { key: "contentInstagram", label: "Instagram" },
  { key: "contentStory", label: "Story Slayti" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
}

function charCount(key: TabKey, val: string): string {
  if (key === "contentLinkedin") return `${val.length} / 3000 karakter`;
  if (key === "contentTwitter") {
    const tweets = val.split("\n\n").filter(Boolean);
    const over = tweets.filter((t) => t.length > 280);
    return `${tweets.length} tweet${over.length > 0 ? ` — ${over.length} tweet 280 kari asiyor` : ""}`;
  }
  if (key === "contentInstagram") return `${val.length} / 2200 karakter`;
  return `${val.length} karakter`;
}

export default function DigestEditor() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id!, 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("contentSummary");
  const [localContent, setLocalContent] = useState<Partial<Record<TabKey, string>>>({});
  const [initialized, setInitialized] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [approveMsg, setApproveMsg] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: digest, isLoading } = useQuery<Digest>({
    queryKey: ["digest", id],
    queryFn: () => apiFetch(`/api/digest/digests/${id}`).then((r) => r.json() as Promise<Digest>),
  });

  useEffect(() => {
    if (digest && !initialized) {
      setLocalContent({
        contentSummary: digest.contentSummary ?? "",
        contentLinkedin: digest.contentLinkedin ?? "",
        contentTwitter: digest.contentTwitter ?? "",
        contentInstagram: digest.contentInstagram ?? "",
        contentStory: digest.contentStory ?? "",
      });
      setInitialized(true);
    }
  }, [digest, initialized]);

  const saveMut = useMutation({
    mutationFn: (body: Partial<Record<TabKey, string>>) =>
      apiFetch(`/api/digest/digests/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      setSaveMsg("Kaydedildi");
      setTimeout(() => setSaveMsg(""), 2000);
      qc.invalidateQueries({ queryKey: ["digest", id] });
    },
  });

  const approveMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/digest/digests/${id}/approve`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      setApproveMsg("Digest onaylandi! Admin'e e-posta gonderildi.");
      qc.invalidateQueries({ queryKey: ["digest", id] });
      qc.invalidateQueries({ queryKey: ["digests"] });
    },
    onError: () => {
      setApproveMsg("Onay sirasinda hata olustu.");
    },
  });

  const handleChange = useCallback(
    (val: string) => {
      setLocalContent((prev) => ({ ...prev, [activeTab]: val }));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveMut.mutate({ [activeTab]: val });
      }, 1500);
    },
    [activeTab, saveMut]
  );

  const handleBlur = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveMut.mutate({ [activeTab]: localContent[activeTab] ?? "" });
  }, [activeTab, localContent, saveMut]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!digest) {
    return <p className="text-muted-foreground">Digest bulunamadi.</p>;
  }

  const currentVal = localContent[activeTab] ?? "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button
            onClick={() => navigate("/digests")}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 block"
          >
            &larr; Digest Listesi
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {digest.weekYear} / Hafta {digest.weekNumber}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              digest.status === "approved"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : digest.status === "sent"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}>
              {digest.status === "draft" ? "Taslak" : digest.status === "approved" ? "Onaylandi" : "Gonderildi"}
            </span>
            {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
          </div>
        </div>

        {digest.status === "draft" && (
          <button
            onClick={() => approveMut.mutate()}
            disabled={approveMut.isPending}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {approveMut.isPending ? "Onaylaniyor..." : "Onayla ve Gonder"}
          </button>
        )}
      </div>

      {approveMsg && (
        <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {approveMsg}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">{charCount(activeTab, currentVal)}</p>
            {saveMut.isPending && (
              <span className="text-xs text-muted-foreground">Kaydediliyor...</span>
            )}
          </div>
          <textarea
            value={currentVal}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            rows={20}
            className="w-full bg-background border border-border rounded-md p-4 text-sm text-foreground font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={`${TABS.find(t => t.key === activeTab)?.label} icerigi buraya yazilacak...`}
          />
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-4 text-xs text-muted-foreground">
        Duzenleme sonrasi otomatik kaydedilir (1.5sn sonra) veya alandan cikildikta. Onay butonu admin'e e-posta bildirim gonderir.
      </div>
    </div>
  );
}
