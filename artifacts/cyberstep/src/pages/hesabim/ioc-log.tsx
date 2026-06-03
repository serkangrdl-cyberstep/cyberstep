import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ShieldAlert, ArrowLeft } from "lucide-react";

interface LogRow {
  id: number;
  iocValue: string;
  iocType: string | null;
  action: string;
  confidenceScore: number | null;
  sources: string[] | null;
  skipReason: string | null;
  createdAt: string | null;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  reported:           { label: "Raporlandi",        color: "bg-blue-100 text-blue-800" },
  block_queued:       { label: "Blok Kuyrugu",      color: "bg-orange-100 text-orange-800" },
  block_sent:         { label: "Blok Gonderildi",   color: "bg-orange-200 text-orange-900" },
  block_confirmed:    { label: "Blok Aktif",        color: "bg-red-100 text-red-800" },
  skipped_whitelist:  { label: "Guvenli (Atlandi)", color: "bg-green-100 text-green-800" },
  skipped_confidence: { label: "Dusuk Guven*",      color: "bg-gray-100 text-gray-600" },
  skipped_disabled:   { label: "Devre Disi",        color: "bg-gray-100 text-gray-500" },
  reverted:           { label: "Geri Alindi",       color: "bg-yellow-100 text-yellow-800" },
  expired:            { label: "Suresi Doldu",      color: "bg-gray-100 text-gray-500" },
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "Yuksek",
  medium: "Orta",
  low: "Dusuk",
  minimal: "Minimal",
};

function confidenceLabel(score: number | null): string {
  if (score === null) return "-";
  if (score >= 80) return "Yuksek";
  if (score >= 60) return "Orta";
  if (score >= 40) return "Dusuk";
  return "Minimal";
}

export default function HesabimIocLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/customer/ioc-log")
      .then(r => r.json())
      .then((d: LogRow[]) => setRows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
        <div>
          <Link href="/hesabim" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
            <ArrowLeft className="h-4 w-4" /> Hesabim
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tehdit Kayit Logu</h1>
            <p className="text-muted-foreground text-sm mt-1">Son 30 gun — tum IOC aksiyon gecmisi</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/customer/ioc-log/export", "_blank")}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV Indir
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              Aksiyon Gecmisi
              {!loading && rows.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">({rows.length} kayit)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Yukleniyor...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Son 30 gunde kayitli tehdit aksiyonu bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zaman</TableHead>
                      <TableHead>Tehdit</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Guven</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(row => {
                      const actionInfo = ACTION_LABELS[row.action];
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {row.createdAt ? new Date(row.createdAt).toLocaleString("tr-TR") : "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate" title={row.iocValue}>
                            {row.iocValue}
                          </TableCell>
                          <TableCell className="text-xs uppercase text-muted-foreground">
                            {row.iocType ?? "-"}
                          </TableCell>
                          <TableCell>
                            {actionInfo ? (
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${actionInfo.color}`}>
                                {actionInfo.label}
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-xs">{row.action}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {confidenceLabel(row.confidenceScore)}
                            {row.confidenceScore !== null && (
                              <span className="text-muted-foreground ml-1">({row.confidenceScore})</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          *Guven skoru minimum esigin altinda olan tehditler rapor edilmez. Denetim amacli PDF export icin CSV dosyasini kullanabilirsiniz.
        </p>
      </div>
    </div>
  );
}
