import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Settings {
  [key: string]: string;
}


async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const FIELDS = [
  { key: "contact.email",    label: "E-posta",         placeholder: "info@cyberstep.io",                          maxLen: 100 },
  { key: "contact.phone",    label: "Telefon",          placeholder: "+90 212 000 00 00",                          maxLen: 30  },
  { key: "contact.address",  label: "Adres",            placeholder: "İstanbul, Türkiye",                          maxLen: 300 },
  { key: "contact.website",  label: "Web Sitesi URL",   placeholder: "https://cyberstep.io",                       maxLen: 150 },
  { key: "contact.linkedin", label: "LinkedIn URL",     placeholder: "https://linkedin.com/company/cyberstep",     maxLen: 200 },
  { key: "contact.twitter",  label: "X (Twitter) URL",  placeholder: "https://x.com/cyberstep",                   maxLen: 200 },
];

export default function IletisimBilgileri() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveMsg, setSaveMsg] = useState("");

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["digest-admin-settings"],
    queryFn: () => adminFetch("/api/admin-panel/settings"),
  });

  useEffect(() => {
    if (settings) {
      const initial: Record<string, string> = {};
      for (const f of FIELDS) initial[f.key] = settings[f.key] ?? "";
      setForm(initial);
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: (data: Record<string, string>) =>
      adminFetch("/api/admin-panel/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-admin-settings"] });
      setSaveMsg("Iletisim bilgileri kaydedildi. Web sitesinde /iletisim sayfasinda gozukecek.");
    },
    onError: () => setSaveMsg("Kayit basarisiz."),
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Iletisim Bilgileri</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Burada kaydedilen bilgiler web sitesinin{" "}
          <a href="/iletisim" target="_blank" className="underline text-primary">/iletisim</a>{" "}
          sayfasinda otomatik gozukur. Bos birakilanlar gosterilmez.
        </p>
      </div>

      {saveMsg && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
          {saveMsg}
          <button onClick={() => setSaveMsg("")} className="ml-3 underline text-xs">Kapat</button>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Yukleniyor...</p>
      ) : (
        <div className="space-y-4">
          {FIELDS.map(({ key, label, placeholder, maxLen }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground block">{label}</label>
              <input
                type={key === "contact.email" ? "email" : "text"}
                maxLength={maxLen}
                value={form[key] ?? ""}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}

          <div className="pt-2">
            <button
              onClick={() => saveMut.mutate(form)}
              disabled={saveMut.isPending}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saveMut.isPending ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          Diger site ayarlari (footer, KVKK, kullanim kosullari) icin{" "}
          <a href="/panel/ayarlar" target="_blank" className="underline text-primary">
            Site Ayarlari
          </a>{" "}
          sayfasini kullanin.
        </p>
      </div>
    </div>
  );
}
