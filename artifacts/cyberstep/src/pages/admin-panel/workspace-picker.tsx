import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Plus, Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/tenant-context";

interface TenantItem {
  id: number;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

export default function WorkspacePicker() {
  const [, navigate] = useLocation();
  const { select, refresh } = useTenant();
  const { toast } = useToast();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/admin-panel/tenants", { credentials: "include" })
      .then(r => r.json())
      .then(data => { setTenants(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSelect(tenantId: number) {
    setSelecting(tenantId);
    try {
      await select(tenantId);
      navigate("/panel");
    } catch (e: unknown) {
      toast({ title: "Hata", description: e instanceof Error ? e.message : "Seçim başarısız", variant: "destructive" });
    } finally {
      setSelecting(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const r = await fetch("/api/admin-panel/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, slug }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: "Hata", description: d.error, variant: "destructive" }); return; }
      await refresh();
      navigate("/panel");
    } catch {
      toast({ title: "Hata", description: "Workspace oluşturulamadı", variant: "destructive" });
    } finally { setCreating(false); }
  }

  function handleLogout() {
    fetch("/api/admin-panel/auth/logout", { method: "POST", credentials: "include" })
      .finally(() => navigate("/panel/login"));
  }

  const planLabel = (plan: string) => {
    if (plan === "pro") return "Pro";
    if (plan === "starter") return "Starter";
    return "Ücretsiz";
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-emerald-500" />
            <span className="text-xl font-bold text-white">CyberStep.io</span>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-sm">
            <LogOut className="h-4 w-4" />
            Çıkış
          </button>
        </div>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white text-lg">Workspace Seçin</CardTitle>
            <CardDescription className="text-slate-400">
              Hangi workspace ile devam etmek istiyorsunuz?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-slate-400 text-sm text-center py-4">Yükleniyor...</div>
            ) : tenants.length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-4">
                Henuz bir workspace'e dahil degilsiniz.
              </div>
            ) : (
              tenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  disabled={selecting !== null}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-700 hover:border-emerald-500 hover:bg-slate-800 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                    <Building2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm">{t.name}</div>
                    <div className="text-slate-400 text-xs">{t.slug}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                      {planLabel(t.plan)}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-500">
                      {t.role}
                    </Badge>
                  </div>
                  {selecting === t.id && (
                    <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              ))
            )}

            <div className="pt-2">
              {!showCreate ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-slate-700 hover:border-emerald-500 text-slate-400 hover:text-emerald-400 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Yeni Workspace Olustur
                </button>
              ) : (
                <form onSubmit={handleCreate} className="space-y-3 border border-slate-700 rounded-lg p-4">
                  <div className="text-white font-medium text-sm mb-1">Yeni Workspace</div>
                  <div className="space-y-1">
                    <Label htmlFor="ws-name" className="text-slate-300 text-xs">Firma Adi</Label>
                    <Input id="ws-name" value={name} onChange={e => setName(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white text-sm h-9"
                      placeholder="Ornek Teknoloji A.S." required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ws-slug" className="text-slate-300 text-xs">Slug (benzersiz kimlik)</Label>
                    <Input id="ws-slug" value={slug}
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                      className="bg-slate-800 border-slate-700 text-white text-sm h-9 font-mono"
                      placeholder="ornek-teknoloji" required />
                    <p className="text-slate-500 text-xs">Kucuk harf, rakam ve - kullanin</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1" disabled={creating}>
                      {creating ? "Olusturuluyor..." : "Olustur"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="border-slate-700 text-slate-300"
                      onClick={() => { setShowCreate(false); setName(""); setSlug(""); }}>
                      Iptal
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
