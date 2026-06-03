import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, ShieldCheck, Info, ArrowLeft } from "lucide-react";

interface WhitelistEntry {
  id: number;
  ipCidr: string;
  label: string | null;
  reason: string | null;
  createdAt: string | null;
  expiresAt: string | null;
}

const REASON_LABELS: Record<string, string> = {
  payment_provider: "Odeme Saglayicisi",
  office_ip: "Ofis IP",
  backup_server: "Yedekleme Sunucusu",
  cdn: "CDN",
  monitoring: "Monitoring",
  other: "Diger",
};

export default function HesabimWhitelist() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ipCidr, setIpCidr] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("other");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/whitelist");
      const data = await res.json() as WhitelistEntry[];
      setEntries(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/customer/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipCidr, label, reason }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Bir hata olustu");
        return;
      }
      setIpCidr("");
      setLabel("");
      setReason("other");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu IP'yi whitelist'ten kaldirmak istiyor musunuz?")) return;
    await fetch(`/api/customer/whitelist/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
        <div className="flex items-center gap-3">
          <Link href="/hesabim" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Hesabim
          </Link>
        </div>
        <div>
          <h1 className="text-2xl font-bold">Guvenli IP Listem</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bu IP'ler CyberStep tarafindan hicbir zaman tehdit olarak isaretle nmez.
          </p>
        </div>

        {/* Info box */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Neden eklerim?</p>
                <ul className="text-muted-foreground list-disc list-inside space-y-0.5">
                  <li>Odeme saglayicisi IP'leri (Iyzico, Stripe vb.)</li>
                  <li>Ofis veya sube statik IP'leri</li>
                  <li>Yedekleme sunucusu adresleri</li>
                  <li>Monitoring servisleri</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              IP Ekle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { void handleAdd(e); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="ip">IP veya CIDR</Label>
                  <Input
                    id="ip"
                    value={ipCidr}
                    onChange={e => setIpCidr(e.target.value)}
                    placeholder="185.1.2.3 veya 185.1.2.0/24"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="label">Aciklama</Label>
                  <Input
                    id="label"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="Iyzico odeme altyapisi"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Kategori</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? "Ekleniyor..." : "Ekle"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Guvenli IP Listem
              {entries.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">({entries.length} kayit)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Yukleniyor...</div>
            ) : entries.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Henuz guvenli IP eklenmemis.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP / CIDR</TableHead>
                    <TableHead>Aciklama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Eklenme</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">{entry.ipCidr}</TableCell>
                      <TableCell className="text-sm">{entry.label ?? "-"}</TableCell>
                      <TableCell className="text-sm">{REASON_LABELS[entry.reason ?? "other"] ?? entry.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("tr-TR") : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { void handleDelete(entry.id); }}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Not: Bu listedeki IP'ler hicbir kosulda engellenemez ve IOC eslesmesi raporlanmaz.
        </p>
      </div>
    </div>
  );
}
