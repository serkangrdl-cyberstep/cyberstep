import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface SpecialMsg {
  id: number;
  title: string;
  messageTr: string;
  messageEn: string | null;
  bgColor: string;
  textColor: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  sendNewsletter: boolean;
  newsletterSent: boolean;
  createdAt: string;
  imageBase64: string | null;
}

const EMPTY: FormState = {
  title: "", messageTr: "", messageEn: "",
  bgColor: "#0f172a", textColor: "#ffffff",
  startAt: "", endAt: "", isActive: true, sendNewsletter: false, imageBase64: "",
};

type FormState = {
  title: string; messageTr: string; messageEn: string;
  bgColor: string; textColor: string;
  startAt: string; endAt: string;
  isActive: boolean; sendNewsletter: boolean; imageBase64: string;
};


async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function toDatetimeLocal(iso: string) {
  return iso ? iso.slice(0, 16) : "";
}

function getStatus(msg: SpecialMsg) {
  if (!msg.isActive) return "inactive";
  const now = new Date();
  if (now < new Date(msg.startAt)) return "upcoming";
  if (now > new Date(msg.endAt)) return "expired";
  return "active";
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active:   { label: "Yayinda",       cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  upcoming: { label: "Planlanmis",    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  expired:  { label: "Suresi Doldu",  cls: "bg-muted text-muted-foreground" },
  inactive: { label: "Pasif",         cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default function OzelGunler() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery<SpecialMsg[]>({
    queryKey: ["digest-special-messages"],
    queryFn: () => adminFetch("/api/admin-panel/special-messages"),
  });

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("imageBase64", (ev.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  };

  const openNew = () => { setEditId(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (item: SpecialMsg) => {
    setEditId(item.id);
    setForm({
      title: item.title, messageTr: item.messageTr, messageEn: item.messageEn ?? "",
      bgColor: item.bgColor, textColor: item.textColor,
      startAt: toDatetimeLocal(item.startAt), endAt: toDatetimeLocal(item.endAt),
      isActive: item.isActive, sendNewsletter: item.sendNewsletter,
      imageBase64: item.imageBase64 ?? "",
    });
    setShowForm(true);
  };

  const saveMut = useMutation({
    mutationFn: async (data: FormState) => {
      const payload = {
        ...data,
        startAt: data.startAt ? new Date(data.startAt).toISOString() : null,
        endAt: data.endAt ? new Date(data.endAt).toISOString() : null,
        imageBase64: data.imageBase64 || null,
      };
      if (editId !== null) {
        return adminFetch(`/api/admin-panel/special-messages/${editId}`, {
          method: "PUT", body: JSON.stringify(payload),
        });
      }
      return adminFetch("/api/admin-panel/special-messages", {
        method: "POST", body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-special-messages"] });
      setShowForm(false); setEditId(null); setForm(EMPTY);
      setMsg(editId !== null ? "Guncellendi." : "Ozel gun mesaji olusturuldu.");
    },
    onError: () => setMsg("Hata olustu."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin-panel/special-messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-special-messages"] });
      setMsg("Silindi.");
    },
    onError: () => setMsg("Silinemedi."),
  });

  const sendNewsletterMut = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin-panel/special-messages/${id}/send-newsletter`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digest-special-messages"] });
      setMsg("Bulten gonderildi.");
    },
    onError: () => setMsg("Gonderim basarisiz."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    saveMut.mutate(form, { onSettled: () => setBusy(false) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ozel Gun Mesajlari</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bayram ve ozel gunlerde web sitesinde banner gosterimi ve bulten gonderin.
          </p>
        </div>
        <button onClick={openNew}
          className="text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          + Yeni Mesaj
        </button>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
          {msg} <button onClick={() => setMsg("")} className="ml-3 underline text-xs">Kapat</button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 space-y-4 shadow-xl mt-8">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {editId !== null ? "Mesaji Duzenle" : "Yeni Ozel Gun Mesaji"}
              </h3>
              <button onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground text-xs border border-border rounded px-2 py-1">
                Kapat
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Baslik *</label>
                <input required value={form.title} onChange={e => set("title", e.target.value)}
                  placeholder="orn. 23 Nisan Ulusal Egemenlik"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Turkce Mesaj *</label>
                <textarea required value={form.messageTr} onChange={e => set("messageTr", e.target.value)}
                  rows={3} placeholder="Mesaj..."
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Ingilizce Mesaj (isteğe bağlı)</label>
                <textarea value={form.messageEn} onChange={e => set("messageEn", e.target.value)}
                  rows={2} placeholder="Message..."
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Baslangic *</label>
                  <input type="datetime-local" required value={form.startAt} onChange={e => set("startAt", e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Bitis *</label>
                  <input type="datetime-local" required value={form.endAt} onChange={e => set("endAt", e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arka Plan Rengi</label>
                  <input type="color" value={form.bgColor} onChange={e => set("bgColor", e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-muted cursor-pointer" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Metin Rengi</label>
                  <input type="color" value={form.textColor} onChange={e => set("textColor", e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-muted cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Gorsel (isteğe bağlı)</label>
                <input ref={imgRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
                <button type="button" onClick={() => imgRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors">
                  {form.imageBase64 ? "Gorsel Secildi" : "Gorsel Sec"}
                </button>
                {form.imageBase64 && (
                  <button type="button" onClick={() => set("imageBase64", "")}
                    className="ml-2 text-xs text-red-500 underline">Kaldir</button>
                )}
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => set("isActive", e.target.checked)}
                    className="rounded border-border" />
                  <span className="text-sm text-foreground">Aktif</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.sendNewsletter} onChange={e => set("sendNewsletter", e.target.checked)}
                    className="rounded border-border" />
                  <span className="text-sm text-foreground">Bulten Gonder</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                  Iptal
                </button>
                <button type="submit" disabled={busy}
                  className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {busy ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yukleniyor...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kayit yok. Yeni mesaj ekleyin.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const st = STATUS_MAP[getStatus(item)] ?? STATUS_MAP["inactive"];
            return (
              <div key={item.id} className="border border-border rounded-xl bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{item.messageTr}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {format(new Date(item.startAt), "d MMM HH:mm", { locale: tr })}
                      {" — "}
                      {format(new Date(item.endAt), "d MMM HH:mm", { locale: tr })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openEdit(item)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground transition-colors">
                    Duzenle
                  </button>
                  {item.sendNewsletter && !item.newsletterSent && (
                    <button onClick={() => sendNewsletterMut.mutate(item.id)} disabled={sendNewsletterMut.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
                      Bulten Gonder
                    </button>
                  )}
                  {item.newsletterSent && (
                    <span className="text-xs px-3 py-1.5 text-green-600 dark:text-green-400">Bulten Gonderildi</span>
                  )}
                  <button onClick={() => { if (confirm("Silmek istediginizden emin misiniz?")) deleteMut.mutate(item.id); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-600/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
