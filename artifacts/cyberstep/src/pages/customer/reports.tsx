import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useRequireCustomer } from "@/hooks/use-customer";
import { TprmNav } from "@/components/tprm-nav";

interface Vendor {
  id: number;
  supplierDomain: string;
  supplierName: string | null;
  lastScanScore: number | null;
  riskLevel: string | null;
  lastScanAt: string | null;
  questionnaireStatus: string;
  remediationStatus?: string;
}

/** Müşteri raporları — yalnızca TPRM: yönetim raporu (portföy) ve tedarikçi bazlı raporlar. */
export default function CustomerReports() {
  usePageMeta({ title: "Raporlar", description: "Tedarikçi risk raporları", noIndex: true });
  const { data: customer } = useRequireCustomer();
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<Vendor[]>({
    queryKey: ["customer-tprm-vendors"],
    queryFn: () => fetch("/api/tprm/vendors", { credentials: "include" }).then(r => r.json()),
    enabled: !!customer,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const vendors = Array.isArray(data) ? data : [];

  async function downloadVendor(v: Vendor) {
    setBusyId(v.id);
    try {
      const res = await fetch(`/api/tprm/vendors/${v.id}/report.pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("PDF indirilemedi");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `CyberStep_Tedarikci_${v.supplierDomain}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusyId(null); }
  }

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-secondary">
      <TprmNav />
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Raporlar</h1>
          <p className="text-sm text-slate-400">Raporlar güncel tarama ve anket verisinden her indirmede otomatik oluşturulur.</p>
        </div>

        <Card className="bg-slate-900 border-emerald-500/30">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-medium">Yönetim Kurulu / Üst Yönetim TPRM Raporu</p>
              <p className="text-xs text-slate-400 mt-1">Portföyün risk özeti, tedarikçi listesi, anket (beyan) ve düzeltme durumu, kritik bulgular, mevzuat bağlamı.</p>
            </div>
            <a href="/api/tprm/vendors/report.pdf">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0" disabled={vendors.length === 0}>
                <Download className="h-4 w-4" /> PDF İndir
              </Button>
            </a>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-white font-medium">Tedarikçi Raporları ({vendors.length})</h2>
          {isLoading && <div className="text-center py-10 text-slate-500">Yükleniyor...</div>}
          {!isLoading && vendors.length === 0 && (
            <Card className="bg-slate-900 border-slate-700"><CardContent className="p-10 text-center">
              <p className="text-slate-400">Henüz tedarikçi eklenmedi.</p>
              <Link href="/hesabim/tedarikci-portfoyu"><Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">Tedarikçi Portföyü</Button></Link>
            </CardContent></Card>
          )}
          {vendors.map(v => (
            <Card key={v.id} className="bg-slate-900 border-slate-700">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{v.supplierName ?? v.supplierDomain}</p>
                  <p className="text-xs text-slate-400">
                    {v.supplierDomain} · Skor: {v.lastScanScore ?? "—"}{v.riskLevel ? ` (${v.riskLevel})` : ""}
                    {v.lastScanAt ? ` · ${new Date(v.lastScanAt).toLocaleDateString("tr-TR")}` : ""}
                    {v.questionnaireStatus === "completed" ? " · Anket tamamlandı" : v.questionnaireStatus === "pending" ? " · Anket bekliyor" : ""}
                    {v.remediationStatus === "rescanned" ? " · Yeniden tarandı, kontrol bekliyor" : v.remediationStatus === "requested" ? " · Yeni tarama sürüyor" : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0 border-slate-600 text-slate-200" disabled={v.lastScanScore === null || busyId === v.id} onClick={() => downloadVendor(v)}>
                  <FileText className="h-3.5 w-3.5" /> {busyId === v.id ? "İndiriliyor..." : "PDF"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
