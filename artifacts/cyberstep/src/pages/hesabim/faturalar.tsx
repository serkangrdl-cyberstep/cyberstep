import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface PortalInvoice {
  id: number;
  full_invoice_number: string;
  invoice_number: string;
  total_tl: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid:    { label: "Ödendi", variant: "default" },
  pending: { label: "Beklemede", variant: "secondary" },
  overdue: { label: "Vadesi Geçti", variant: "destructive" },
  cancelled: { label: "İptal", variant: "outline" },
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; }
function fmtMoney(n: string | number) { return Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2 }); }

export default function HesabimFaturalar() {
  const { data: invoices = [], isLoading } = useQuery<PortalInvoice[]>({
    queryKey: ["/api/portal/invoices"],
    queryFn: () => fetch("/api/portal/invoices", { credentials: "include" }).then(r => r.json()),
  });

  const downloadPdf = (id: number, num: string) => {
    const a = document.createElement("a");
    a.href = `/api/portal/invoices/${id}/pdf`;
    a.download = `${num}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Faturalarım</h2>
        <p className="text-slate-400 text-sm">Tüm faturalarınızı buradan görüntüleyebilir ve indirebilirsiniz.</p>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-12">Yükleniyor...</div>
      ) : invoices.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Henüz fatura bulunmuyor.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Fatura No", "Tutar", "Durum", "Vade / Ödeme", ""].map(h => (
                      <th key={h} className="text-left text-slate-400 font-medium px-4 py-3 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const st = STATUS_LABELS[inv.status] ?? STATUS_LABELS["pending"]!;
                    return (
                      <tr key={inv.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-white font-mono text-xs">{inv.full_invoice_number ?? inv.invoice_number}</td>
                        <td className="px-4 py-3 text-white font-medium">₺{fmtMoney(inv.total_tl)}</td>
                        <td className="px-4 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className={`px-4 py-3 text-xs ${inv.status === "overdue" ? "text-red-400" : "text-slate-400"}`}>
                          {inv.status === "paid" ? `Ödendi: ${fmtDate(inv.paid_at)}` : `Vade: ${fmtDate(inv.due_date)}`}
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" className="border-slate-700 h-7 text-xs" onClick={() => downloadPdf(inv.id, inv.full_invoice_number ?? inv.invoice_number)}>
                            <Download className="h-3 w-3 mr-1" /> PDF
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
