import { useState } from "react";
import { AdminLayout } from "../../components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function adminFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

interface CyberRiskReport {
  id: number;
  periodType: string;
  periodLabel: string;
  sector: string | null;
  status: string;
  reportData: Record<string, unknown> | null;
  pdfUrl: string | null;
  webSlug: string | null;
  createdAt: string;
  publishedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

function statusBadge(status: string) {
  if (status === "published") return <Badge className="bg-green-600 text-white">Yayında</Badge>;
  if (status === "pending_review") return <Badge className="bg-yellow-500 text-white">Onay Bekliyor</Badge>;
  return <Badge variant="outline">Taslak</Badge>;
}

function periodTypeLabel(t: string) {
  if (t === "monthly") return "Aylık";
  if (t === "quarterly") return "Çeyreklik";
  if (t === "yearly") return "Yıllık";
  return t;
}

export default function AdminRiskRaporlari() {
  const qc = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [newForm, setNewForm] = useState({
    periodType: "monthly",
    periodLabel: "",
    sector: "",
    reviewNotes: "",
  });

  const { data: allReports = [], isLoading } = useQuery<CyberRiskReport[]>({
    queryKey: ["cyber-risk-reports"],
    queryFn: () => adminFetch("/api/admin-panel/cyber-risk-reports/list"),
  });

  const pending = allReports.filter(r => r.status === "pending_review");
  const published = allReports.filter(r => r.status === "published");
  const drafts = allReports.filter(r => r.status === "draft");

  const createMut = useMutation({
    mutationFn: (body: typeof newForm) =>
      adminFetch("/api/admin-panel/cyber-risk-reports", {
        method: "POST",
        body: JSON.stringify({
          periodType: body.periodType,
          periodLabel: body.periodLabel,
          sector: body.sector || undefined,
          reviewNotes: body.reviewNotes || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cyber-risk-reports"] });
      setNewForm({ periodType: "monthly", periodLabel: "", sector: "", reviewNotes: "" });
    },
  });

  const submitMut = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin-panel/cyber-risk-reports/${id}/submit`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cyber-risk-reports"] }),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      adminFetch(`/api/admin-panel/cyber-risk-reports/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ reviewNotes: notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cyber-risk-reports"] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      adminFetch(`/api/admin-panel/cyber-risk-reports/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reviewNotes: notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cyber-risk-reports"] }),
  });

  const collectMut = useMutation({
    mutationFn: () =>
      adminFetch<{ success: boolean; snapshotsWritten: number }>(
        "/api/admin-panel/cyber-risk-reports/collect-metrics",
        { method: "POST" }
      ),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin-panel/cyber-risk-reports/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cyber-risk-reports"] }),
  });

  return (
    <AdminLayout title="Dönemsel Risk Raporları">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dönemsel Risk Raporları</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Aylık / çeyreklik / yıllık siber risk raporu yönetimi — Faz 1 altyapı
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => collectMut.mutate()}
            disabled={collectMut.isPending}
          >
            {collectMut.isPending ? "Toplanıyor..." : "Metrikleri Topla"}
          </Button>
        </div>

        {collectMut.isSuccess && (
          <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">
            Metrik snapshot yazıldı: {collectMut.data?.snapshotsWritten} kayıt
          </div>
        )}

        <Tabs defaultValue="onay">
          <TabsList>
            <TabsTrigger value="onay">
              Onay Bekleyen {pending.length > 0 && <span className="ml-1 text-yellow-600">({pending.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="yayinlanan">
              Yayınlananlar {published.length > 0 && <span className="ml-1 text-green-600">({published.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="taslak">
              Taslaklar {drafts.length > 0 && <span className="ml-1">({drafts.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="yeni">Manuel Oluştur</TabsTrigger>
          </TabsList>

          {/* ── Onay Bekleyen ── */}
          <TabsContent value="onay">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">Onay bekleyen rapor yok.</p>
            ) : (
              <div className="space-y-4">
                {pending.map(r => (
                  <Card key={r.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {periodTypeLabel(r.periodType)} — {r.periodLabel}
                          {r.sector && <span className="text-muted-foreground ml-2 text-sm">({r.sector})</span>}
                        </CardTitle>
                        {statusBadge(r.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Oluşturuldu: {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs">İnceleme Notu</Label>
                        <Textarea
                          rows={2}
                          placeholder="Onay / red sebebi..."
                          value={reviewNotes[r.id] ?? ""}
                          onChange={e => setReviewNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMut.mutate({ id: r.id, notes: reviewNotes[r.id] })}
                          disabled={approveMut.isPending}
                        >
                          Onayla ve Yayınla
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectMut.mutate({ id: r.id, notes: reviewNotes[r.id] })}
                          disabled={rejectMut.isPending}
                        >
                          Reddet (Taslağa Al)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Yayınlananlar ── */}
          <TabsContent value="yayinlanan">
            {published.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">Yayınlanan rapor yok.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dönem</TableHead>
                    <TableHead>Sektör</TableHead>
                    <TableHead>Yayın Tarihi</TableHead>
                    <TableHead>Onaylayan</TableHead>
                    <TableHead>PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {published.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className="font-medium">{r.periodLabel}</span>
                        <span className="text-muted-foreground text-xs ml-2">({periodTypeLabel(r.periodType)})</span>
                      </TableCell>
                      <TableCell>{r.sector ?? <span className="text-muted-foreground">Genel</span>}</TableCell>
                      <TableCell>
                        {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("tr-TR") : "-"}
                      </TableCell>
                      <TableCell>{r.reviewedBy ?? "-"}</TableCell>
                      <TableCell>
                        {r.pdfUrl
                          ? <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="text-primary underline text-sm">PDF</a>
                          : <span className="text-muted-foreground text-xs">Henüz yok</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── Taslaklar ── */}
          <TabsContent value="taslak">
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">Taslak rapor yok.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dönem</TableHead>
                    <TableHead>Sektör</TableHead>
                    <TableHead>Oluşturuldu</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className="font-medium">{r.periodLabel}</span>
                        <span className="text-muted-foreground text-xs ml-2">({periodTypeLabel(r.periodType)})</span>
                      </TableCell>
                      <TableCell>{r.sector ?? <span className="text-muted-foreground">Genel</span>}</TableCell>
                      <TableCell>{new Date(r.createdAt).toLocaleDateString("tr-TR")}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => submitMut.mutate(r.id)}
                            disabled={submitMut.isPending}
                          >
                            Onaya Gönder
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => { if (confirm("Silinsin mi?")) deleteMut.mutate(r.id); }}
                          >
                            Sil
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── Manuel Oluştur ── */}
          <TabsContent value="yeni">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Yeni Taslak Rapor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Dönem Tipi</Label>
                    <Select
                      value={newForm.periodType}
                      onValueChange={v => setNewForm(f => ({ ...f, periodType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Aylık</SelectItem>
                        <SelectItem value="quarterly">Çeyreklik</SelectItem>
                        <SelectItem value="yearly">Yıllık</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Dönem Etiketi</Label>
                    <Input
                      placeholder="örn. 2026-06 veya 2026-Q2"
                      value={newForm.periodLabel}
                      onChange={e => setNewForm(f => ({ ...f, periodLabel: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Sektör <span className="text-muted-foreground text-xs">(boş = genel/tüm sektörler)</span></Label>
                  <Input
                    placeholder="örn. Sağlık, Finans — boş bırakılabilir"
                    value={newForm.sector}
                    onChange={e => setNewForm(f => ({ ...f, sector: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Not <span className="text-muted-foreground text-xs">(isteğe bağlı)</span></Label>
                  <Textarea
                    rows={2}
                    placeholder="İç not..."
                    value={newForm.reviewNotes}
                    onChange={e => setNewForm(f => ({ ...f, reviewNotes: e.target.value }))}
                  />
                </div>
                <Button
                  onClick={() => createMut.mutate(newForm)}
                  disabled={createMut.isPending || !newForm.periodLabel}
                >
                  {createMut.isPending ? "Oluşturuluyor..." : "Taslak Oluştur"}
                </Button>
                {createMut.isSuccess && (
                  <p className="text-sm text-green-600">Taslak oluşturuldu.</p>
                )}
                {createMut.isError && (
                  <p className="text-sm text-destructive">{String(createMut.error)}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
