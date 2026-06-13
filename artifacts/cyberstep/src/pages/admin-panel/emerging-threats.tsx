import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Send, X, RefreshCw, ShieldAlert } from "lucide-react";

interface EmergingAlert {
  id: number;
  cveId: string | null;
  customerId: number | null;
  technologyMatched: string | null;
  emailStatus: string | null;
  sentAt: string | null;
  createdAt: string | null;
  customerEmail: string | null;
  customerName: string | null;
  cvssScore: string | null;
  cveTitle: string | null;
  patchAvailable: boolean | null;
  exploitPublic: boolean | null;
}

const BASE = "/api";

function statusBadge(status: string | null) {
  if (status === "sent") return <Badge className="bg-green-100 text-green-700 border-green-200">Gönderildi</Badge>;
  if (status === "failed") return <Badge className="bg-slate-100 text-slate-500 border-slate-200">Reddedildi</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Bekliyor</Badge>;
}

export default function AdminEmergingThreats() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "failed">("pending");

  const { data: alerts = [], isLoading } = useQuery<EmergingAlert[]>({
    queryKey: ["emerging-threats"],
    queryFn: () => fetch(`${BASE}/admin-panel/emerging-threats`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/admin-panel/emerging-threats/${id}/send`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (data, id) => {
      if (data.ok) { toast({ title: "Gönderildi", description: `Alert #${id} başarıyla iletildi` }); }
      else { toast({ title: "Hata", description: data.error, variant: "destructive" }); }
      qc.invalidateQueries({ queryKey: ["emerging-threats"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/admin-panel/emerging-threats/${id}/reject`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["emerging-threats"] }); },
  });

  const checkNowMutation = useMutation({
    mutationFn: () => fetch(`${BASE}/admin-panel/emerging-threats/check-now`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Kontrol Başlatıldı", description: "CVE eşleştirme arka planda çalışıyor" });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["emerging-threats"] }), 5000);
    },
  });

  const filtered = alerts.filter(a => filter === "all" || a.emailStatus === filter);
  const pendingCount = alerts.filter(a => a.emailStatus === "pending").length;

  return (
    <AdminLayout title="Acil Tehdit Bildirimleri">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-500" /> Acil Tehdit Bildirimleri
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Step AI tarafından tespit edilen acil CVE eşleşmeleri — gözden geçirin ve gönderin</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkNowMutation.mutate()}
            disabled={checkNowMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checkNowMutation.isPending ? "animate-spin" : ""}`} />
            Şimdi Kontrol Et
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-amber-500">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Bekleyen</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-green-600">{alerts.filter(a => a.emailStatus === "sent").length}</div>
              <div className="text-sm text-muted-foreground">Gönderildi</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-slate-500">{alerts.length}</div>
              <div className="text-sm text-muted-foreground">Toplam</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Alert Kuyruğu
              </CardTitle>
              <div className="flex gap-1">
                {(["pending", "all", "sent", "failed"] as const).map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant={filter === f ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setFilter(f)}
                  >
                    {f === "pending" ? "Bekleyen" : f === "all" ? "Tümü" : f === "sent" ? "Gönderilen" : "Reddedilen"}
                    {f === "pending" && pendingCount > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 text-[10px]">{pendingCount}</span>}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Yükleniyor...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {filter === "pending" ? "Bekleyen alert yok" : "Bu filtreye uygun alert bulunamadı"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CVE</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Eşleşen Teknoloji</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-mono font-bold text-red-600 text-sm">{a.cveId}</div>
                        {a.cveTitle && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{a.cveTitle}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{a.customerName}</div>
                        <div className="text-xs text-muted-foreground">{a.customerEmail}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                          {a.technologyMatched ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {a.cvssScore && (
                          <span className={`font-bold text-sm ${parseFloat(a.cvssScore) >= 9 ? "text-red-600" : "text-orange-500"}`}>
                            {a.cvssScore}
                          </span>
                        )}
                        <div className="flex gap-1 mt-0.5">
                          {a.exploitPublic && <span className="text-[10px] px-1 py-0.5 bg-red-100 text-red-600 rounded">Exploit</span>}
                          {!a.patchAvailable && <span className="text-[10px] px-1 py-0.5 bg-slate-100 text-slate-600 rounded">Yama yok</span>}
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(a.emailStatus)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString("tr-TR") : "—"}
                      </TableCell>
                      <TableCell>
                        {a.emailStatus === "pending" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => sendMutation.mutate(a.id)}
                              disabled={sendMutation.isPending}
                            >
                              <Send className="h-3 w-3 mr-1" /> Gönder
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
                              onClick={() => rejectMutation.mutate(a.id)}
                              disabled={rejectMutation.isPending}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
