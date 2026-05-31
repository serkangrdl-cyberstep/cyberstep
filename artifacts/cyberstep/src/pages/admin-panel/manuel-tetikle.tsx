import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, AlertCircle } from "lucide-react";

interface Customer { id: number; company_name: string; email: string; domain: string | null; }

const SERVICES = [
  { slug: "domain-scan",       label: "Domain Güvenlik Taraması",       endpoint: (id: number) => `/api/domain-scan/trigger/${id}`,         method: "POST", needsDomain: true },
  { slug: "assessment",        label: "Mini Risk Değerlendirmesi",       endpoint: (id: number) => `/api/admin/trigger/assessment/${id}`,    method: "POST", needsDomain: false },
  { slug: "phishing",          label: "AI Phishing Simülasyonu",         endpoint: (id: number) => `/api/admin/trigger/phishing/${id}`,      method: "POST", needsDomain: false },
  { slug: "pentest-lite",      label: "Pentest Lite",                    endpoint: (id: number) => `/api/admin/trigger/pentest-lite/${id}`,  method: "POST", needsDomain: false },
  { slug: "ai-assessment",     label: "AI Güvenlik Değerlendirmesi",     endpoint: (id: number) => `/api/admin/trigger/ai-assessment/${id}`, method: "POST", needsDomain: false },
  { slug: "deepfake",          label: "Deepfake Tehdit Analizi",         endpoint: (id: number) => `/api/admin/trigger/deepfake/${id}`,      method: "POST", needsDomain: false },
  { slug: "red-team",          label: "AI Red Team Raporu",              endpoint: (id: number) => `/api/admin/trigger/red-team/${id}`,      method: "POST", needsDomain: false },
  { slug: "eu-ai-act",         label: "EU AI Act Uyum Skoru",            endpoint: (id: number) => `/api/admin/trigger/eu-ai-act/${id}`,     method: "POST", needsDomain: false },
  { slug: "board-report",      label: "YK Güvenlik Raporu",              endpoint: (id: number) => `/api/board-report/generate/${id}`,      method: "POST", needsDomain: false },
  { slug: "nps",               label: "NPS Anketi Gönder",               endpoint: (id: number) => `/api/crm/nps/send/${id}`,               method: "POST", needsDomain: false },
  { slug: "health-score",      label: "Sağlık Skoru Hesapla",            endpoint: (id: number) => `/api/admin/health/recalculate/${id}`,    method: "POST", needsDomain: false },
];

interface TriggerResult { slug: string; ok: boolean; message: string; }

export default function AdminManuelTetikle() {
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [results, setResults] = useState<TriggerResult[]>([]);
  const [triggering, setTriggering] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["admin-customers-list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/customers?limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("Yüklenemedi");
      const d = await res.json();
      return d.customers ?? d;
    },
  });

  const customer = customers.find(c => c.id === selectedCustomer);

  const trigger = async (service: typeof SERVICES[0]) => {
    if (!selectedCustomer) return;
    setTriggering(service.slug);
    try {
      const res = await fetch(service.endpoint(selectedCustomer), {
        method: service.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const ok = res.ok;
      const d = await res.json().catch(() => ({}));
      setResults(r => [{ slug: service.slug, ok, message: d.message ?? d.error ?? (ok ? "Başlatıldı" : "Hata") }, ...r]);
    } catch {
      setResults(r => [{ slug: service.slug, ok: false, message: "Bağlantı hatası" }, ...r]);
    }
    setTriggering(null);
  };

  return (
    <AdminLayout title="Manuel Tetikleme">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Manuel Servis Tetikleme</h1>
          <p className="text-slate-400 text-sm mt-1">Seçili müşteri için herhangi bir servisi test amaçlı tetikleyin.</p>
        </div>

        {/* Müşteri Seç */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <label className="text-sm font-medium text-slate-300 block mb-2">Müşteri Seç</label>
          {isLoading ? (
            <p className="text-slate-500 text-sm">Yükleniyor...</p>
          ) : (
            <select
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2.5"
              value={selectedCustomer ?? ""}
              onChange={e => setSelectedCustomer(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">— Müşteri seçin —</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.company_name} ({c.email})</option>
              ))}
            </select>
          )}
          {customer && (
            <p className="text-xs text-slate-500 mt-2">
              Seçili: <strong className="text-slate-300">{customer.company_name}</strong>
              {customer.domain ? ` · ${customer.domain}` : ""} · ID: {customer.id}
            </p>
          )}
        </div>

        {/* Servis Listesi */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700">
            <p className="text-sm font-medium text-slate-300">Servisler</p>
          </div>
          <div className="divide-y divide-slate-700/50">
            {SERVICES.map(svc => {
              const result = results.find(r => r.slug === svc.slug);
              const isRunning = triggering === svc.slug;
              return (
                <div key={svc.slug} className="flex items-center justify-between px-5 py-4 hover:bg-slate-700/20 transition-colors">
                  <div>
                    <p className="text-white text-sm font-medium">{svc.label}</p>
                    <p className="text-slate-500 text-xs">{svc.endpoint(0).replace("/0", "/:id")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {result && (
                      <span className={`flex items-center gap-1 text-xs font-medium ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {result.ok ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                        {result.message}
                      </span>
                    )}
                    <Button
                      size="sm"
                      disabled={!selectedCustomer || isRunning}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs gap-1.5"
                      onClick={() => trigger(svc)}
                    >
                      <Play className="h-3 w-3" />
                      {isRunning ? "Çalışıyor..." : "Tetikle"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sonuç Geçmişi */}
        {results.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-300">Sonuç Geçmişi</p>
              <button onClick={() => setResults([])} className="text-xs text-slate-500 hover:text-slate-300">Temizle</button>
            </div>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${r.ok ? "bg-emerald-900/20 text-emerald-400" : "bg-red-900/20 text-red-400"}`}>
                  {r.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                  <span className="font-medium">{SERVICES.find(s => s.slug === r.slug)?.label ?? r.slug}:</span>
                  <span>{r.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
