import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Plus, Pencil, Trash2, Send, CalendarHeart, ImagePlus, X, Clock, CheckCircle2, XCircle
} from "lucide-react";
import { useRequireAdmin } from "@/hooks/use-admin";

interface SpecialDayMessage {
  id: number;
  title: string;
  messageTr: string;
  messageEn: string | null;
  imageBase64: string | null;
  bgColor: string;
  textColor: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  sendNewsletter: boolean;
  newsletterSent: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  title: "",
  messageTr: "",
  messageEn: "",
  imageBase64: "",
  bgColor: "#0f172a",
  textColor: "#ffffff",
  startAt: "",
  endAt: "",
  isActive: true,
  sendNewsletter: false,
};

type FormState = typeof EMPTY_FORM;

function toDatetimeLocal(iso: string) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function getStatus(msg: SpecialDayMessage): "active" | "upcoming" | "expired" | "inactive" {
  if (!msg.isActive) return "inactive";
  const now = new Date();
  const start = new Date(msg.startAt);
  const end = new Date(msg.endAt);
  if (now < start) return "upcoming";
  if (now > end) return "expired";
  return "active";
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:   { label: "Yayinda",   cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  upcoming: { label: "Planlanmis", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  expired:  { label: "Suresi Doldu", cls: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  inactive: { label: "Pasif",     cls: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function MessageForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (data: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const imgRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("imageBase64", (ev.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-slate-300">Baslik *</Label>
          <Input
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            placeholder="orn. 23 Nisan Ulusal Egemenlik ve Cocuk Bayrami"
            value={form.title}
            onChange={e => set("title", e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-slate-300">Turkce Mesaj *</Label>
          <Textarea
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[90px]"
            placeholder="Turk milletinin 23 Nisan kutlu olsun..."
            value={form.messageTr}
            onChange={e => set("messageTr", e.target.value)}
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-slate-300">Ingilizce Mesaj <span className="text-slate-500 text-xs">(isteğe bağlı)</span></Label>
          <Textarea
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[80px]"
            placeholder="Happy National Sovereignty and Children's Day..."
            value={form.messageEn}
            onChange={e => set("messageEn", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-300">Yayim Baslangici *</Label>
          <Input
            type="datetime-local"
            className="bg-slate-800 border-slate-700 text-white"
            value={form.startAt}
            onChange={e => set("startAt", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-300">Yayim Bitis *</Label>
          <Input
            type="datetime-local"
            className="bg-slate-800 border-slate-700 text-white"
            value={form.endAt}
            onChange={e => set("endAt", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-300">Arkaplan Rengi</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.bgColor} onChange={e => set("bgColor", e.target.value)} className="h-9 w-14 rounded cursor-pointer border border-slate-700 bg-slate-800" />
            <Input
              className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
              value={form.bgColor}
              onChange={e => set("bgColor", e.target.value)}
              maxLength={7}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-300">Yazi Rengi</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.textColor} onChange={e => set("textColor", e.target.value)} className="h-9 w-14 rounded cursor-pointer border border-slate-700 bg-slate-800" />
            <Input
              className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
              value={form.textColor}
              onChange={e => set("textColor", e.target.value)}
              maxLength={7}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="md:col-span-2">
          <Label className="text-slate-300 block mb-2">Banner Onizleme</Label>
          <div
            className="w-full rounded-lg p-4 flex items-center gap-4"
            style={{ backgroundColor: form.bgColor, color: form.textColor }}
          >
            {form.imageBase64 && (
              <img src={form.imageBase64} alt="preview" className="h-12 w-12 object-contain rounded shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: form.textColor }}>{form.title || "Baslik..."}</p>
              <p className="text-xs opacity-80 truncate" style={{ color: form.textColor }}>{form.messageTr || "Mesaj..."}</p>
            </div>
          </div>
        </div>

        {/* Image upload */}
        <div className="space-y-1.5">
          <Label className="text-slate-300">Gorsel <span className="text-slate-500 text-xs">(isteğe bağlı, PNG/JPG/SVG)</span></Label>
          <div className="flex items-center gap-2">
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            <Button type="button" variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white" onClick={() => imgRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-1.5" /> Gorsel Sec
            </Button>
            {form.imageBase64 && (
              <Button type="button" variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2" onClick={() => set("imageBase64", "")}>
                <X className="h-4 w-4" />
              </Button>
            )}
            {form.imageBase64 && <img src={form.imageBase64} alt="" className="h-8 w-8 object-contain rounded" />}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300">Aktif</Label>
            <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-slate-300">Abonelere E-posta Gonder</Label>
              <p className="text-xs text-slate-500 mt-0.5">Kaydet butonuna tikladiginda gonderilmez — ayri "Gonder" butonu var</p>
            </div>
            <Switch checked={form.sendNewsletter} onCheckedChange={v => set("sendNewsletter", v)} />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={() => onSave(form)} disabled={saving || !form.title || !form.messageTr || !form.startAt || !form.endAt}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button variant="outline" className="border-slate-700 text-slate-300" onClick={onCancel}>
          Iptal
        </Button>
      </div>
    </div>
  );
}

export default function AdminSpecialMessages() {
  useRequireAdmin();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editInitial, setEditInitial] = useState<FormState>(EMPTY_FORM);

  const { data: messages = [], isLoading } = useQuery<SpecialDayMessage[]>({
    queryKey: ["admin-special-messages"],
    queryFn: () => fetch("/api/admin-panel/special-messages", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) =>
      fetch("/api/admin-panel/special-messages", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startAt: data.startAt ? new Date(data.startAt).toISOString() : undefined,
          endAt: data.endAt ? new Date(data.endAt).toISOString() : undefined,
        }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-special-messages"] }); setView("list"); toast({ title: "Olusturuldu" }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) =>
      fetch(`/api/admin-panel/special-messages/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startAt: data.startAt ? new Date(data.startAt).toISOString() : undefined,
          endAt: data.endAt ? new Date(data.endAt).toISOString() : undefined,
        }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-special-messages"] }); setView("list"); toast({ title: "Guncellendi" }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/special-messages/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-special-messages"] }); toast({ title: "Silindi" }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin-panel/special-messages/${id}/send-newsletter`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (data: { sent: number }) => {
      qc.invalidateQueries({ queryKey: ["admin-special-messages"] });
      toast({ title: `Bulten gonderildi`, description: `${data.sent} aboneye gonderildi` });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const handleEdit = (msg: SpecialDayMessage) => {
    setEditInitial({
      title: msg.title,
      messageTr: msg.messageTr,
      messageEn: msg.messageEn ?? "",
      imageBase64: msg.imageBase64 ?? "",
      bgColor: msg.bgColor,
      textColor: msg.textColor,
      startAt: toDatetimeLocal(msg.startAt),
      endAt: toDatetimeLocal(msg.endAt),
      isActive: msg.isActive,
      sendNewsletter: msg.sendNewsletter,
    });
    setEditingId(msg.id);
    setView("edit");
  };

  const fmt = (d: string) => format(new Date(d), "d MMM yyyy HH:mm", { locale: tr });

  return (
    <AdminLayout
      title="Ozel Gun Mesajlari"
      description="Milli bayramlar, dini gunler, ozel gunler icin ana sayfa banner'i"
    >
      {view === "list" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">{messages.length} kayit</p>
            <Button onClick={() => setView("create")} className="bg-emerald-600 hover:bg-emerald-500">
              <Plus className="h-4 w-4 mr-1.5" /> Yeni Mesaj
            </Button>
          </div>

          {isLoading ? (
            <div className="text-slate-400 text-center py-16">Yukleniyor...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <CalendarHeart className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Henuz ozel gun mesaji yok</p>
              <p className="text-sm mt-1">Milli ve dini bayramlar icin mesaj ekleyin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map(msg => {
                const status = getStatus(msg);
                const sb = STATUS_BADGE[status];
                return (
                  <div key={msg.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <div className="flex items-start gap-4">
                      {/* color swatch */}
                      <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: msg.bgColor }}>
                        {msg.imageBase64 ? (
                          <img src={msg.imageBase64} alt="" className="w-8 h-8 object-contain rounded" />
                        ) : (
                          <CalendarHeart className="h-5 w-5" style={{ color: msg.textColor }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-white font-semibold text-sm">{msg.title}</span>
                          <Badge className={sb.cls}>{sb.label}</Badge>
                          {msg.newsletterSent && (
                            <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Bulten Gonderildi
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-400 text-xs mb-2 line-clamp-2">{msg.messageTr}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmt(msg.startAt)}</span>
                          <span>→</span>
                          <span>{fmt(msg.endAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {msg.sendNewsletter && !msg.newsletterSent && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-violet-700 text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 text-xs"
                            onClick={() => { if (confirm("Abonelere bulten gonderilsin mi?")) sendMutation.mutate(msg.id); }}
                            disabled={sendMutation.isPending}
                          >
                            <Send className="h-3 w-3 mr-1" /> Bulten Gonder
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-700 p-2" onClick={() => handleEdit(msg)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2" onClick={() => { if (confirm("Silinsin mi?")) deleteMutation.mutate(msg.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "create" && (
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2" onClick={() => setView("list")}>
              <XCircle className="h-4 w-4" />
            </Button>
            <h2 className="text-white font-semibold">Yeni Ozel Gun Mesaji</h2>
          </div>
          <MessageForm
            initial={EMPTY_FORM}
            onSave={data => createMutation.mutate(data)}
            onCancel={() => setView("list")}
            saving={createMutation.isPending}
          />
        </div>
      )}

      {view === "edit" && editingId && (
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2" onClick={() => setView("list")}>
              <XCircle className="h-4 w-4" />
            </Button>
            <h2 className="text-white font-semibold">Mesaji Duzenle</h2>
          </div>
          <MessageForm
            initial={editInitial}
            onSave={data => updateMutation.mutate({ id: editingId, data })}
            onCancel={() => setView("list")}
            saving={updateMutation.isPending}
          />
        </div>
      )}
    </AdminLayout>
  );
}
